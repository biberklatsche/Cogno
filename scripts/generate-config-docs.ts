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
 * `--site` also writes the website page into the sibling `meetcogno` repo.
 *
 * Run: `npx tsx scripts/generate-config-docs.ts [--check] [--site]`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { baseConfigSchemaShape } from "../src/core/infrastructure/config/models/config";
import {
  defaultSettings,
  platformSettingOverrides,
} from "../src/core/infrastructure/config/models/default-config-values";
import { HexColorSchema } from "../src/core/infrastructure/config/models/shared";
import { defaultFeatureSettingsExtension } from "../src/features/feature-settings-extension";
import { hexColorSchema } from "../src/shared/contributions/feature-settings";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DOCS_MD = `${REPO_ROOT}/docs/config.md`;
const SITE_MD = `${REPO_ROOT}/../meetcogno/src/content/docs/config/settings.md`;

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
  { keys: ["color"], title: "Colors", lead: "Colors are hex without `#`; 8 digits add alpha." },
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

function unwrap(schema: ZodLike | undefined): {
  schema: ZodLike | undefined;
  description?: string;
} {
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

/** True when the schema is a hex color, however often it is wrapped in optional/default. */
function isHexColor(schema: ZodLike | undefined): boolean {
  let current = schema;
  for (let guard = 0; guard < 10 && current; guard++) {
    if (current === HexColorSchema || current === hexColorSchema) return true;
    const def = defOf(current);
    if (def?.type !== "optional" && def?.type !== "nullable" && def?.type !== "default") break;
    current = def.innerType;
  }
  return false;
}

function renderType(schema: ZodLike | undefined): string {
  // Hex colors are a preprocessed regex; name them rather than print the regex.
  if (isHexColor(schema)) return "hex color";
  const { schema: inner } = unwrap(schema);
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
        .map((value) => `\`${value}\``)
        .join(" | ");
    case "literal":
      return (def.values ?? []).map((value) => `\`${String(value)}\``).join(" | ");
    case "union":
      return (def.options ?? []).map((option) => renderType(option)).join(" | ");
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

/** A value as inline code; a backtick inside needs the double-backtick form. */
function codeSpan(value: string): string {
  if (value === "") return "*(empty)*";
  return value.includes("`") ? `\`\` ${value} \`\`` : `\`${value}\``;
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
  const rendered = base === undefined ? "—" : codeSpan(base);
  if (overrides.length === 0) return rendered;
  const perOs = overrides.map(([os, value]) => `${os}: ${codeSpan(value ?? "")}`).join(", ");
  return `${rendered} (${perOs})`;
}

/**
 * Emits one row per setting a user can actually write. Objects and records are
 * only containers, so they get no row of their own; a record's description moves
 * to its `<name>` entry when that entry has none.
 */
function walk(
  schema: ZodLike | undefined,
  path: string,
  rows: Row[],
  inheritedDescription?: string,
): void {
  const { schema: inner, description } = unwrap(schema);
  const def = defOf(inner);
  if (!def) return;

  if (def.type === "object" && def.shape) {
    for (const [key, child] of Object.entries(def.shape)) {
      walk(child, path ? `${path}.${key}` : key, rows);
    }
    return;
  }

  if (def.type === "record" && def.valueType) {
    walk(def.valueType, `${path}.${recordPlaceholder(path)}`, rows, description);
    return;
  }

  // A union of objects (prompt segments) documents the union of their fields.
  if (
    def.type === "union" &&
    (def.options ?? []).some((o) => defOf(unwrap(o).schema)?.type === "object")
  ) {
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
    type: renderType(schema),
    def: defaultFor(path),
    description: description ?? inheritedDescription ?? "",
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

/** One linkable heading per setting: description first, then type and default. */
function renderSetting(row: Row): string {
  const facts = [`**Type:** ${row.type || "—"}`];
  if (row.def && row.def !== "—") facts.push(`**Default:** ${row.def}`);
  const lines = [`### \`${row.key}\``, ""];
  if (row.description) lines.push(row.description, "");
  lines.push(facts.join(" · "), "");
  return lines.join("\n");
}

/** The reference body, shared by `docs/config.md` and the website page. */
function renderBody(): string {
  const parts: string[] = [];
  for (const section of SECTIONS) {
    const rows = section.keys.flatMap((key) => rowsFor(key));
    if (rows.length === 0) continue;
    parts.push(`## ${section.title}`, "");
    if (section.lead) parts.push(section.lead, "");
    for (const row of rows) parts.push(renderSetting(row));
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

const INTRO = [
  "Every Cogno setting with its type, default and meaning. Settings are written as",
  "`key = value` lines in `~/.cogno/cogno.config`; only the values you override need to be",
  "present. Where a default differs per operating system, the platform is named in",
  "brackets.",
].join("\n");

function render(): string {
  return [
    "<!-- Generated by scripts/generate-config-docs.ts from the Zod schemas. Do not edit. -->",
    "",
    "# Settings reference",
    "",
    INTRO,
    "",
    renderBody(),
  ].join("\n");
}

/** The same reference as a Starlight page of the website (sibling `meetcogno` repo). */
function renderSitePage(): string {
  return [
    "---",
    "title: All settings",
    "description: Reference of every Cogno setting with its type, default and meaning.",
    "slug: docs/config/settings",
    "---",
    "",
    "<!-- Generated by Cogno/scripts/generate-config-docs.ts. Do not edit. -->",
    "",
    `${INTRO} See the [configuration overview](/docs/config) for the file format.`,
    "",
    renderBody(),
  ].join("\n");
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
  if (process.argv.includes("--site")) {
    writeFileSync(SITE_MD, renderSitePage());
    console.log(`config docs: wrote ${SITE_MD}`);
  }
}

main();
