/**
 * Generates the settings reference from the Zod schemas.
 *
 * The schemas are the single source of truth: the key comes from the shape, the
 * type and its constraints from the Zod definition, the description from
 * `.describe()`, and the default from `default-config-values.ts` (the same file
 * that generates the shipped `default_*.config`). Nothing here is hand-written,
 * so the reference cannot drift from the code.
 *
 * `--check` fails if `docs/config.md` on disk differs from a fresh render (CI,
 * part of `pnpm lint`), the same contract as `generate-actions.ts`.
 *
 * Run: `npx tsx scripts/generate-config-docs.ts [--check]`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { baseConfigSchemaShape } from "../src/packages/core/infrastructure/config/models/config";
import {
  defaultSettings,
  platformSettingOverrides,
} from "../src/packages/core/infrastructure/config/models/default-config-values";
import { HexColorSchema } from "../src/packages/core/infrastructure/config/models/shared";
import { defaultFeatureSettingsExtension } from "../src/packages/features/feature-settings-extension";
import { hexColorSchema } from "../src/packages/shared/contributions/feature-settings";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DOCS_MD = `${REPO_ROOT}/docs/config.md`;

/** Zod 4 keeps the definition under `_zod.def`; typed as unknown on purpose. */
type ZodLike = { _zod?: { def?: Def }; description?: string };
type Def = {
  type: string;
  shape?: Record<string, ZodLike>;
  innerType?: ZodLike;
  valueType?: ZodLike;
  element?: ZodLike;
  options?: ZodLike[];
  entries?: Record<string, string>;
  values?: unknown[];
  in?: ZodLike;
  out?: ZodLike;
  checks?: Array<{ _zod?: { def?: CheckDef } } & CheckDef>;
};
type CheckDef = { check?: string; value?: number; format?: string; inclusive?: boolean };

const defOf = (schema: ZodLike | undefined): Def | undefined => schema?._zod?.def;

/** Section order and headings; every top-level config key must appear here. */
const SECTIONS: ReadonlyArray<{ keys: readonly string[]; title: string; lead?: string }> = [
  { keys: ["enable_watch_config"], title: "General" },
  { keys: ["font"], title: "Font" },
  { keys: ["color"], title: "Colors", lead: "Colours are hex without `#`; 8 digits add alpha." },
  { keys: ["cursor"], title: "Cursor" },
  { keys: ["padding"], title: "Padding" },
  { keys: ["background_image"], title: "Background image" },
  { keys: ["menu"], title: "Menu" },
  { keys: ["scrollbar"], title: "Scrollbar" },
  { keys: ["selection"], title: "Selection" },
  { keys: ["clipboard"], title: "Clipboard" },
  {
    keys: ["shell"],
    title: "Shell",
    lead: "`<name>` is a profile name you choose. At most 9 profiles; `shell.default` must name one of them.",
  },
  {
    keys: ["prompt"],
    title: "Prompt",
    lead: "`<name>` is a profile or segment name you choose. A segment sets exactly one of `field` or `text`.",
  },
  { keys: ["keybind"], title: "Keybindings" },
  { keys: ["terminal"], title: "Terminal" },
  { keys: ["autocomplete"], title: "Autocomplete" },
  { keys: ["notification"], title: "Notifications" },
  { keys: ["http_server"], title: "HTTP server" },
  {
    keys: ["feature"],
    title: "Features",
    lead: "Each feature can be switched off entirely and ordered in the side menu.",
  },
];

type Row = { key: string; type: string; def: string; description: string };

/** What a user-chosen key in a record is called, so nested records stay readable. */
function recordPlaceholder(path: string): string {
  const lastKey = path.split(".").at(-1) ?? "";
  return lastKey === "env" ? "<var>" : "<name>";
}

function unwrap(schema: ZodLike | undefined): { schema: ZodLike | undefined; description?: string } {
  let current = schema;
  let description = schema?.description;
  for (let guard = 0; guard < 10 && current; guard++) {
    const def = defOf(current);
    if (!def) break;
    if (def.type === "optional" || def.type === "nullable" || def.type === "default") {
      current = def.innerType;
      description = description ?? current?.description;
      continue;
    }
    if (def.type === "pipe") {
      // z.preprocess(...): the validated schema is the output side.
      const out = def.out;
      if (out === undefined) break;
      current = out;
      description = description ?? current?.description;
      continue;
    }
    break;
  }
  return { schema: current, description };
}

function numberType(def: Def): string {
  let isInteger = false;
  let min: number | undefined;
  let max: number | undefined;
  for (const check of def.checks ?? []) {
    const checkDef = check._zod?.def ?? check;
    if (checkDef.check === "number_format") isInteger = true;
    if (checkDef.check === "greater_than") min = checkDef.value;
    if (checkDef.check === "less_than") max = checkDef.value;
  }
  const base = isInteger ? "integer" : "number";
  if (min !== undefined && max !== undefined) return `${base} ${min}-${max}`;
  if (min !== undefined) return `${base} ≥ ${min}`;
  if (max !== undefined) return `${base} ≤ ${max}`;
  return base;
}

function renderType(schema: ZodLike | undefined): string {
  // Hex colours are a preprocessed regex; name them rather than print the regex.
  if (schema === HexColorSchema || schema === hexColorSchema) return "hex colour";
  const { schema: inner } = unwrap(schema);
  if (inner === HexColorSchema || inner === hexColorSchema) return "hex colour";
  const def = defOf(inner);
  if (!def) return "—";
  switch (def.type) {
    case "boolean":
      return "boolean";
    case "number":
      return numberType(def);
    case "string":
      return "string";
    case "enum":
      return Object.keys(def.entries ?? {})
        .map((value) => `\`"${value}"\``)
        .join(" ");
    case "literal":
      return (def.values ?? []).map((value) => `\`"${String(value)}"\``).join(" ");
    case "union":
      return (def.options ?? []).map((option) => renderType(option)).join(" \\| ");
    case "array":
      return `${renderType(def.element)}[]`;
    case "record":
      return "map";
    case "object":
      return "group";
    default:
      return def.type;
  }
}

function defaultFor(path: string): string {
  const fromTree = (tree: unknown): string | undefined => {
    let node: unknown = tree;
    for (const part of path.split(".")) {
      if (typeof node !== "object" || node === null) return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : undefined;
  };

  const base = fromTree(defaultSettings);
  const overrides = Object.entries(platformSettingOverrides)
    .map(([os, tree]) => [os, fromTree(tree)] as const)
    .filter(([, value]) => value !== undefined && value !== base);

  if (base === undefined && overrides.length === 0) return "—";
  const rendered = base === undefined ? "—" : `\`${base}\``;
  if (overrides.length === 0) return rendered;
  const perOs = overrides.map(([os, value]) => `${os}: \`${value}\``).join(", ");
  return `${rendered} (${perOs})`;
}

function walk(schema: ZodLike | undefined, path: string, rows: Row[]): void {
  const { schema: inner, description } = unwrap(schema);
  const def = defOf(inner);
  if (!def) return;

  if (def.type === "object" && def.shape) {
    if (description && path) {
      rows.push({ key: path, type: "group", def: "", description });
    }
    for (const [key, child] of Object.entries(def.shape)) {
      walk(child, path ? `${path}.${key}` : key, rows);
    }
    return;
  }

  if (def.type === "record" && def.valueType) {
    if (description && path) {
      rows.push({ key: path, type: "group", def: "", description });
    }
    walk(def.valueType, `${path}.${recordPlaceholder(path)}`, rows);
    return;
  }

  // A union of objects (prompt segments) documents the union of their fields.
  if (def.type === "union" && (def.options ?? []).some((o) => defOf(unwrap(o).schema)?.type === "object")) {
    if (description && path) {
      rows.push({ key: path, type: "group", def: "", description });
    }
    const seen = new Set<string>();
    for (const option of def.options ?? []) {
      const optionRows: Row[] = [];
      walk(option, path, optionRows);
      for (const row of optionRows) {
        if (seen.has(row.key)) continue;
        seen.add(row.key);
        rows.push(row);
      }
    }
    return;
  }

  rows.push({
    key: path,
    type: renderType(inner),
    def: defaultFor(path),
    description: description ?? "",
  });
}

function rowsFor(key: string): Row[] {
  const shape: Record<string, ZodLike> = {
    ...(baseConfigSchemaShape as unknown as Record<string, ZodLike>),
    ...(defaultFeatureSettingsExtension.schemaShape as unknown as Record<string, ZodLike>),
  };
  const rows: Row[] = [];
  walk(shape[key], key, rows);
  return rows;
}

function renderTable(rows: Row[]): string {
  const lines = ["| Setting | Type | Default | Description |", "|---|---|---|---|"];
  for (const row of rows) {
    lines.push(
      `| \`${row.key}\` | ${row.type || "—"} | ${row.def || "—"} | ${row.description || "—"} |`,
    );
  }
  return lines.join("\n");
}

function render(): string {
  const parts = [
    "<!-- Generated by scripts/generate-config-docs.ts from the Zod schemas. Do not edit. -->",
    "",
    "# Settings reference",
    "",
    "Every Cogno setting, its type, default and meaning. Written as `key = value` lines in",
    "`~/.cogno/cogno.config` (`~/.cogno-dev` in development builds); only the values you",
    "override need to be present.",
    "",
    "A `group` row documents a block of related settings rather than a value of its own.",
    "Where a default differs per operating system, the platform is named in brackets;",
    "otherwise the value applies everywhere.",
    "",
  ];

  for (const section of SECTIONS) {
    const rows = section.keys.flatMap((key) => rowsFor(key));
    if (rows.length === 0) continue;
    parts.push(`## ${section.title}`, "");
    if (section.lead) parts.push(section.lead, "");
    parts.push(renderTable(rows), "");
  }

  return `${parts.join("\n").trimEnd()}\n`;
}

function main(): void {
  const content = render();
  if (process.argv.includes("--check")) {
    const onDisk = readFileSync(DOCS_MD, "utf8");
    if (onDisk !== content) {
      console.error(
        "config docs: docs/config.md is stale. Run `pnpm generate:config-docs` and commit the result.",
      );
      process.exit(1);
    }
    console.log("config docs: docs/config.md is current.");
    return;
  }
  writeFileSync(DOCS_MD, content);
  console.log(`config docs: wrote ${DOCS_MD}`);
}

main();
