#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const ROOT = process.cwd();
const FIG_ROOT = path.join(ROOT, "scripts", "fig-commands");
const OUT_ROOT = path.join(ROOT, "src", "assets", "autocomplete", "fig");
const OUT_SPECS = path.join(OUT_ROOT, "commands");

const issues = [];
const providerCatalog = new Map();
const moduleCache = new Map();
const cjsRequire = createRequire(import.meta.url);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanOut() {
  if (fs.existsSync(OUT_ROOT)) fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  ensureDir(OUT_SPECS);
}

function listSpecFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!p.endsWith(".ts") || p.endsWith(".d.ts")) continue;
      out.push(p);
    }
  }
  return out.sort();
}

function logIssue(kind, file, message, extra = undefined) {
  issues.push({ kind, file: path.relative(ROOT, file), message, extra });
}

function isSpecLike(value) {
  if (!value || typeof value !== "object") return false;
  const obj = value;
  return typeof obj.name === "string" || Array.isArray(obj.name);
}

function transpileTs(tsSource, filename) {
  const res = ts.transpileModule(tsSource, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      allowJs: true,
    },
    reportDiagnostics: false,
  });
  return res.outputText;
}

function figGeneratorsStub() {
  const passthrough = (...args) => ({ __figStub: true, name: "stub", args });
  const aiFn = (...args) => ({ __figStub: true, name: "ai", args });
  aiFn.execute = passthrough;
  aiFn.createClarityWrapper = passthrough;

  const proxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "default") return proxy;
        if (prop === "ai") return aiFn;
        return passthrough;
      },
    },
  );
  return proxy;
}

function resolveRequire(fromFile, request) {
  if (request.startsWith("node:")) {
    return cjsRequire(request);
  }
  if (request === "typescript") return ts;
  if (request === "@fig/autocomplete-generators") {
    return figGeneratorsStub();
  }
  if (request.startsWith("./") || request.startsWith("../")) {
    const base = path.resolve(path.dirname(fromFile), request);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.js`,
      path.join(base, "index.ts"),
      path.join(base, "index.js"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        if (candidate.endsWith(".ts")) return loadTsModule(candidate);
        return cjsRequire(candidate);
      }
    }
    throw new Error(`Cannot resolve local module '${request}' from ${fromFile}`);
  }
  return cjsRequire(request);
}

function loadTsModule(file) {
  const full = path.resolve(file);
  if (moduleCache.has(full)) return moduleCache.get(full).exports;

  const module = { exports: {} };
  moduleCache.set(full, module);

  const source = fs.readFileSync(full, "utf8");
  const js = transpileTs(source, full);

  const wrapped = `(function (exports, require, module, __filename, __dirname) {\n${js}\n})`;
  const script = new vm.Script(wrapped, { filename: full, displayErrors: true });
  const fn = script.runInThisContext();

  const localRequire = (request) => resolveRequire(full, request);
  fn(module.exports, localRequire, module, full, path.dirname(full));
  return module.exports;
}

function firstName(name) {
  if (Array.isArray(name)) return String(name[0] ?? "").trim();
  return String(name ?? "").trim();
}

function sanitizeNames(name) {
  const arr = Array.isArray(name) ? name : [name];
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const t = String(v ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function normalizeArgs(args) {
  if (!args) return undefined;
  const arr = Array.isArray(args) ? args : [args];
  const out = [];
  for (const a of arr) {
    if (!a || typeof a !== "object") continue;
    const name = String(a.name ?? "").trim();
    if (!name) continue;
    const row = { name };
    if (typeof a.description === "string" && a.description.trim()) {
      row.description = a.description.trim();
    }
    out.push(row);
  }
  return out.length ? out : undefined;
}

function safeRel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function slug(input) {
  return input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function registerProvider(file, commandName, locationKey, generator, postProcess) {
  const id = `fig-${slug(commandName)}-${slug(locationKey)}`;
  if (!providerCatalog.has(id)) {
    const entry = {
      id,
      command: commandName,
      sourceFile: safeRel(file),
      location: locationKey,
      generator: mapGeneratorPayload(generator),
      postProcessSource: typeof postProcess === "function" ? String(postProcess) : undefined,
    };
    providerCatalog.set(id, entry);
  }
  return id;
}

function mapGeneratorPayload(generator) {
  if (!generator) return { type: "unknown" };
  if (Array.isArray(generator)) {
    return { type: "script-array", script: generator.map(v => String(v)) };
  }
  if (typeof generator === "string") {
    return { type: "script-string", script: generator };
  }
  if (typeof generator === "function") {
    return { type: "custom-function", source: String(generator) };
  }
  if (typeof generator === "object") {
    if (generator.script) {
      if (Array.isArray(generator.script)) return { type: "script-array", script: generator.script.map(v => String(v)) };
      if (typeof generator.script === "string") return { type: "script-string", script: generator.script };
    }
    if (typeof generator.custom === "function") {
      return { type: "custom-function", source: String(generator.custom) };
    }
    if (generator.custom && typeof generator.custom === "object") {
      return { type: "custom-object", value: generator.custom };
    }
    return { type: "generator-object", value: generator };
  }
  return { type: typeof generator };
}

function issueSummary() {
  const byKind = {};
  for (const row of issues) {
    byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
  }
  return byKind;
}

function extractProviderBindings(file, commandName, locationKey, rawArgs) {
  if (!rawArgs || typeof rawArgs !== "object") return undefined;
  const generators = rawArgs.generators;
  if (!generators) return undefined;

  const list = Array.isArray(generators) ? generators : [generators];
  const bindings = [];
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    const pid = registerProvider(file, commandName, `${locationKey}-gen-${i}`, g, rawArgs.postProcess);
    bindings.push({
      providerId: pid,
      kind: "script",
      source: "fig-generator",
      baseScore: 58,
    });
  }
  return bindings.length ? bindings : undefined;
}

function mapOption(file, commandName, raw, locationKey) {
  if (typeof raw === "string") return { name: raw };
  if (!raw || typeof raw !== "object") return undefined;

  const names = sanitizeNames(raw.name);
  if (!names.length) return undefined;

  const out = {
    name: names.length === 1 ? names[0] : names,
    description: typeof raw.description === "string" ? raw.description.trim() : undefined,
    isRepeatable: !!raw.isRepeatable || undefined,
    args: normalizeArgs(raw.args),
    providers: extractProviderBindings(file, commandName, `${locationKey}-option-${firstName(raw.name)}`, raw.args),
  };

  if (Array.isArray(raw.options)) {
    logIssue("unsupported", file, `Nested options inside option are ignored (${firstName(raw.name)})`);
  }

  return out;
}

function mapSubcommand(file, commandName, raw, locationKey) {
  if (typeof raw === "string") return { name: raw };
  if (!raw || typeof raw !== "object") return undefined;

  const names = sanitizeNames(raw.name);
  if (!names.length) return undefined;

  const out = {
    name: names.length === 1 ? names[0] : names,
    description: typeof raw.description === "string" ? raw.description.trim() : undefined,
    args: normalizeArgs(raw.args),
    providers: extractProviderBindings(file, commandName, `${locationKey}-sub-${firstName(raw.name)}`, raw.args),
    options: undefined,
    subcommands: undefined,
  };

  if (Array.isArray(raw.options)) {
    const mapped = raw.options.map((o, i) => mapOption(file, commandName, o, `${locationKey}-sub-${firstName(raw.name)}-opt-${i}`)).filter(Boolean);
    if (mapped.length) out.options = mapped;
  }
  if (Array.isArray(raw.subcommands)) {
    const mapped = raw.subcommands.map((s, i) => mapSubcommand(file, commandName, s, `${locationKey}-sub-${firstName(raw.name)}-${i}`)).filter(Boolean);
    if (mapped.length) out.subcommands = mapped;
  }

  return out;
}

function mapSpec(file, rawSpec) {
  const commandName = firstName(rawSpec.name);
  if (!commandName) return null;

  const mapped = {
    name: commandName,
    source: "fig",
    sourceUrl: `https://github.com/withfig/autocomplete/tree/master/src/${safeRel(file).replace(/^scripts\/fig-commands\//, "")}`,
    description: typeof rawSpec.description === "string" ? rawSpec.description.trim() : undefined,
    options: undefined,
    subcommands: undefined,
    providers: undefined,
  };

  if (Array.isArray(rawSpec.options)) {
    const options = rawSpec.options.map((o, i) => mapOption(file, commandName, o, `root-opt-${i}`)).filter(Boolean);
    if (options.length) mapped.options = options;
  }

  if (Array.isArray(rawSpec.subcommands)) {
    const subs = rawSpec.subcommands.map((s, i) => mapSubcommand(file, commandName, s, `root-sub-${i}`)).filter(Boolean);
    if (subs.length) mapped.subcommands = subs;
  }

  return mapped;
}

function pickSpecExport(mod) {
  const candidates = [
    mod?.default,
    mod?.completionSpec,
    mod?.spec,
    mod?.completion,
  ];
  for (const c of candidates) {
    if (isSpecLike(c)) return c;
  }
  for (const value of Object.values(mod ?? {})) {
    if (isSpecLike(value)) return value;
  }
  return null;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function importFile(file) {
  try {
    const mod = loadTsModule(file);
    const rawSpec = pickSpecExport(mod);
    if (!rawSpec) {
      logIssue("skip", file, "No Fig spec export found");
      return null;
    }

    const mapped = mapSpec(file, rawSpec);
    if (!mapped) {
      logIssue("skip", file, "Spec could not be mapped");
      return null;
    }
    return mapped;
  } catch (err) {
    logIssue("error", file, "Import failed", String(err?.stack || err));
    return null;
  }
}

function main() {
  if (!fs.existsSync(FIG_ROOT)) {
    console.error(`Missing folder: ${FIG_ROOT}`);
    process.exit(1);
  }

  cleanOut();
  const files = listSpecFiles(FIG_ROOT);
  const imported = [];
  const usedSpecNames = new Map();

  for (const file of files) {
    const mapped = importFile(file);
    if (!mapped) continue;
    imported.push(mapped);

    const base = slug(mapped.name) || "unknown";
    const seq = usedSpecNames.get(base) ?? 0;
    usedSpecNames.set(base, seq + 1);
    const fileName = seq === 0 ? `${base}.json` : `${base}-${seq + 1}.json`;
    const outFile = path.join(OUT_SPECS, fileName);
    writeJson(outFile, mapped);
  }

  writeJson(path.join(OUT_ROOT, "index.json"), {
    generatedAt: new Date().toISOString(),
    sourceRoot: safeRel(FIG_ROOT),
    importedSpecs: imported.length,
    providerCount: providerCatalog.size,
    issuesByKind: issueSummary(),
    files: imported.map(v => v.name).sort(),
  });

  writeJson(path.join(OUT_ROOT, "issues.json"), issues);

  const manifest = imported
    .map((spec) => ({
      name: spec.name,
      file: `${slug(spec.name)}.json`,
      shells: spec.shells,
      excludeShells: spec.excludeShells,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  writeJson(path.join(OUT_ROOT, "manifest.json"), manifest);

  console.log(`Imported specs: ${imported.length}`);
  console.log(`Extracted providers: ${providerCatalog.size}`);
  console.log(`Issues: ${issues.length}`);
}

main();
