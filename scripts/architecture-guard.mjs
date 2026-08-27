#!/usr/bin/env node
// Migration guard (ARCHITECTURE.md 2.1, transition rules).
//
// Two guarantees while the rebuild runs:
//
// 1. src/packages/app/ may only shrink, and the frozen alias @cogno/app may
//    only lose consumers. Both are counted and compared with
//    .architecture-baseline.json.
// 2. Scaffolding put up for one step gets torn down again. Anything that only
//    exists to bridge the migration carries a marker
//
//      // MIGRATION-TEMP(step 19): reason
//
//    naming the step that removes it. Once that step is done - baseline
//    currentStep has reached it - the marker is an error until it is gone.
//
// Deleted in migration step 29 together with app/ and the alias.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const legacyRoot = join(repoRoot, "src/packages/app");
const baselineFile = join(repoRoot, ".architecture-baseline.json");
const sourceRoot = join(repoRoot, "src/packages");

/** Every .ts file below dir that is not a spec. */
function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
      found.push(full);
    }
  }
  return found;
}

const allSources = sourceFiles(sourceRoot);
const legacyFiles = sourceFiles(legacyRoot);
const legacyAliasImports = allSources.filter((file) =>
  /from\s+["']@cogno\/app(?:["'/])/.test(readFileSync(file, "utf8")),
).length;

const current = { legacyFiles: legacyFiles.length, legacyAliasImports };

if (!existsSync(baselineFile)) {
  writeFileSync(baselineFile, `${JSON.stringify({ currentStep: 0, ...current }, null, 2)}\n`);
  console.log("architecture-guard: baseline written", current);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselineFile, "utf8"));
const currentStep = baseline.currentStep ?? 0;

// --- 2. scaffolding is torn down on time ---------------------------------
const markerPattern = /MIGRATION-TEMP\(step (\d+)\)/g;
const overdue = [];
for (const file of [...allSources, ...sourceFiles(join(repoRoot, "scripts"))]) {
  const text = readFileSync(file, "utf8");
  for (const [, step] of text.matchAll(markerPattern)) {
    if (Number(step) <= currentStep) {
      overdue.push(`${relative(repoRoot, file)} -> step ${step}`);
    }
  }
}
if (overdue.length > 0) {
  console.error(
    `architecture-guard: migration step ${currentStep} is done, so this scaffolding must be gone.`,
  );
  console.error("");
  for (const entry of overdue) console.error(`  ${entry}`);
  console.error("");
  console.error("Remove it, or move the marker to the step that really removes it.");
  process.exit(1);
}

// --- 1. app/ only shrinks ------------------------------------------------
const grown = Object.keys(current).filter((key) => current[key] > (baseline[key] ?? 0));

if (grown.length > 0) {
  console.error("architecture-guard: these numbers must not grow during the migration.\n");
  for (const key of grown) {
    console.error(`  ${key}: ${baseline[key]} -> ${current[key]}`);
  }
  console.error(
    "\nNew code belongs in the target layout (core/, features/, bootstrap/),\n" +
      "not in src/packages/app/, and must not import @cogno/app.\n" +
      `See ARCHITECTURE.md 2.1 and ${relative(repoRoot, baselineFile)}.`,
  );
  process.exit(1);
}

const shrunk = Object.keys(current).filter((key) => current[key] < (baseline[key] ?? 0));
if (shrunk.length > 0) {
  writeFileSync(baselineFile, `${JSON.stringify({ ...baseline, ...current }, null, 2)}\n`);
  console.log(
    "architecture-guard: baseline lowered",
    shrunk.map((key) => `${key} ${baseline[key]} -> ${current[key]}`).join(", "),
  );
} else {
  console.log(`architecture-guard: step ${currentStep}, unchanged`, current);
}
