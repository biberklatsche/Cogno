import { hexColorSchema } from "@cogno/core/api/contributions";
import { UNLIMITED } from "@cogno/core/api/contributions/limit-setting";
import type { z } from "zod";
import { type ZodDef, zodDef } from "./zod-def";

/**
 * Reads the config schema the way a person needs it: one entry per setting
 * with its key, section, description, control and default. The settings
 * reference and the settings panel both come from here, so neither can say
 * something the other does not (ARCHITECTURE.md 5).
 */

/** How a setting is edited; derived from its Zod definition, never declared twice. */
export type SettingControl =
  | { readonly kind: "boolean" }
  | { readonly kind: "enum"; readonly values: ReadonlyArray<string> }
  | {
      readonly kind: "number";
      readonly integer: boolean;
      readonly min?: number;
      readonly max?: number;
    }
  /** A whole number or `unlimited`. */
  | { readonly kind: "limit"; readonly min: number }
  | { readonly kind: "string"; readonly hexColor: boolean }
  | { readonly kind: "list"; readonly item: SettingControl }
  /** Something the panel does not edit: a keybind line, or a shape it cannot read. */
  | { readonly kind: "file-only"; readonly type: string };

export type SettingDefault = {
  /** The value for every platform, as the config file spells it. */
  readonly base?: string;
  /** Platforms whose value differs from `base`. */
  readonly perOs: Readonly<Record<string, string>>;
};

export type SettingDescriptor = {
  /** The dotted key as it stands in the file; `<name>` where the person picks a name. */
  readonly key: string;
  readonly section: string;
  /** The key's parents, outermost first, for headings between settings. */
  readonly groups: ReadonlyArray<SettingGroup>;
  readonly description: string;
  readonly control: SettingControl;
  readonly default: SettingDefault;
  /** The record this setting lives in, when its parent is a map of user-named entries. */
  readonly record?: string;
};

/** A parent of settings: named by its `.meta({ title })`, else by its key; described by `.describe()`. */
export type SettingGroup = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
};

export type SettingSection = {
  readonly key: string;
  readonly title: string;
  readonly lead?: string;
};

/** Section order and headings; every top-level config key must appear here. */
export const SETTING_SECTIONS: ReadonlyArray<SettingSection> = [
  { key: "enable_watch_config", title: "General" },
  { key: "font", title: "Font" },
  { key: "color", title: "Colors", lead: "Colors are hex without `#`; 8 digits add alpha." },
  { key: "cursor", title: "Cursor" },
  { key: "padding", title: "Padding" },
  { key: "background_image", title: "Background image" },
  { key: "menu", title: "Menu" },
  { key: "scrollbar", title: "Scrollbar" },
  { key: "selection", title: "Selection" },
  { key: "clipboard", title: "Clipboard" },
  {
    key: "shell",
    title: "Shell",
    lead: "`<name>` is a profile name you choose. At most 9 profiles; `shell.default` must name one of them.",
  },
  {
    key: "prompt",
    title: "Prompt",
    lead: "`<name>` is a profile or segment name you choose. A segment sets exactly one of `field` or `text`.",
  },
  { key: "keybind", title: "Keybindings" },
  { key: "terminal", title: "Terminal" },
  { key: "autocomplete", title: "Autocomplete" },
  { key: "notification", title: "Notifications" },
  { key: "http_server", title: "HTTP server" },
  { key: "updater", title: "Updates" },
  {
    key: "feature",
    title: "Features",
    lead: "Each feature can be switched off entirely and ordered in the side menu.",
  },
];

/** Raw default values as `default-config-values.ts` holds them: strings, nested by key. */
type DefaultTree = { readonly [key: string]: string | DefaultTree };

export type DescribeSettingsOptions = {
  readonly defaults: DefaultTree;
  readonly platformOverrides: Readonly<Record<string, DefaultTree>>;
};

/** Every setting of `shape`, in section order; `shape` is the composed config schema's shape. */
export function describeSettings(
  shape: Readonly<Record<string, unknown>>,
  options: DescribeSettingsOptions,
): SettingDescriptor[] {
  const descriptors: SettingDescriptor[] = [];
  for (const section of SETTING_SECTIONS) {
    walk(
      shape[section.key] as z.ZodType | undefined,
      section.key,
      section.title,
      [],
      options,
      descriptors,
    );
  }
  return descriptors;
}

/** The type as the reference prints it: `integer ≥ 0`, `` `a` | `b` ``, `hex color`. */
export function controlLabel(control: SettingControl): string {
  switch (control.kind) {
    case "boolean":
      return "boolean";
    case "enum":
      return control.values.map((value) => `\`${value}\``).join(" | ");
    case "number": {
      const base = control.integer ? "integer" : "number";
      if (control.min !== undefined && control.max !== undefined) {
        return `${base} ${control.min}-${control.max}`;
      }
      if (control.min !== undefined) return `${base} ≥ ${control.min}`;
      if (control.max !== undefined) return `${base} ≤ ${control.max}`;
      return base;
    }
    case "limit":
      return `\`${UNLIMITED}\` | integer ≥ ${control.min}`;
    case "string":
      return control.hexColor ? "hex color" : "string";
    case "list":
      return `${controlLabel(control.item)}[]`;
    case "file-only":
      return control.type;
  }
}

/** The default on one platform, as the file spells it; undefined when there is none. */
export function defaultOn(setting: SettingDescriptor, platform: string): string | undefined {
  return setting.default.perOs[platform] ?? setting.default.base;
}

function walk(
  schema: z.ZodType | undefined,
  path: string,
  section: string,
  groups: ReadonlyArray<SettingGroup>,
  options: DescribeSettingsOptions,
  out: SettingDescriptor[],
  inherited?: { description?: string; record?: string },
): void {
  const { schema: inner, description } = unwrap(schema);
  const def = zodDef(inner);
  if (!def) return;

  if (def.type === "object" && def.shape) {
    const nextGroups = [...groups, groupOf(schema, inner, path, description)];
    for (const [key, child] of Object.entries(def.shape)) {
      walk(child, path ? `${path}.${key}` : key, section, nextGroups, options, out, {
        record: inherited?.record,
      });
    }
    return;
  }

  if (def.type === "record" && def.valueType) {
    // A map of user-named entries: the entries are described under `<name>`,
    // and every one of them remembers the record it lives in.
    walk(
      def.valueType,
      `${path}.${recordPlaceholder(path)}`,
      section,
      [...groups, groupOf(schema, inner, path, description)],
      options,
      out,
      { description, record: inherited?.record ?? path },
    );
    return;
  }

  // A union of objects (prompt segments) documents the union of their fields.
  if (
    def.type === "union" &&
    (def.options ?? []).some((option) => zodDef(unwrap(option).schema)?.type === "object")
  ) {
    const seen = new Set<string>();
    for (const option of def.options ?? []) {
      const optionRows: SettingDescriptor[] = [];
      walk(option, path, section, groups, options, optionRows, inherited);
      for (const row of optionRows) {
        if (seen.has(row.key)) continue;
        seen.add(row.key);
        out.push(row);
      }
    }
    return;
  }

  out.push({
    key: path,
    section,
    groups,
    description: description ?? inherited?.description ?? "",
    control: path === "keybind" ? { kind: "file-only", type: "keybind lines" } : controlOf(schema),
    default: defaultFor(path, options),
    ...(inherited?.record ? { record: inherited.record } : {}),
  });
}

function controlOf(schema: z.ZodType | undefined): SettingControl {
  // Hex colors are a preprocessed regex; name them rather than print the regex.
  if (isHexColor(schema)) return { kind: "string", hexColor: true };
  const { schema: inner } = unwrap(schema);
  const def = zodDef(inner);
  if (!def) return { kind: "file-only", type: "—" };
  switch (def.type) {
    case "boolean":
      return { kind: "boolean" };
    case "number":
      return numberControl(def);
    case "string":
      return { kind: "string", hexColor: false };
    case "enum":
      return { kind: "enum", values: Object.keys(def.entries ?? {}) };
    case "literal":
      return { kind: "enum", values: (def.values ?? []).map((value) => String(value)) };
    case "union":
      return unionControl(def);
    case "array": {
      const item = controlOf(def.element);
      return item.kind === "file-only"
        ? { kind: "file-only", type: `${item.type}[]` }
        : { kind: "list", item };
    }
    case "record":
      return { kind: "file-only", type: "map" };
    case "object":
      return { kind: "file-only", type: "group" };
    default:
      return { kind: "file-only", type: def.type };
  }
}

/** `unlimited | integer ≥ n` is a limit; any other union of scalars is a choice or file-only. */
function unionControl(def: ZodDef): SettingControl {
  const options = (def.options ?? []).map((option) => ({
    option,
    def: zodDef(unwrap(option).schema),
  }));
  const unlimited = options.find(
    (entry) => entry.def?.type === "literal" && (entry.def.values ?? []).includes(UNLIMITED),
  );
  const number = options.find((entry) => entry.def?.type === "number");
  if (unlimited && number && options.length === 2) {
    const control = numberControl(number.def as ZodDef);
    return { kind: "limit", min: control.kind === "number" ? (control.min ?? 0) : 0 };
  }
  if (options.every((entry) => entry.def?.type === "literal" || entry.def?.type === "enum")) {
    return {
      kind: "enum",
      values: options.flatMap((entry) =>
        entry.def?.type === "enum"
          ? Object.keys(entry.def.entries ?? {})
          : (entry.def?.values ?? []).map((value) => String(value)),
      ),
    };
  }
  return {
    kind: "file-only",
    type: options.map((entry) => controlLabel(controlOf(entry.option))).join(" | "),
  };
}

function numberControl(def: ZodDef): SettingControl {
  let integer = false;
  let min: number | undefined;
  let max: number | undefined;
  for (const check of def.checks ?? []) {
    const checkDef = check._zod?.def ?? check;
    if (checkDef.check === "number_format") integer = true;
    if (checkDef.check === "greater_than") min = checkDef.value;
    if (checkDef.check === "less_than") max = checkDef.value;
  }
  return {
    kind: "number",
    integer,
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
  };
}

function groupOf(
  schema: z.ZodType | undefined,
  inner: z.ZodType | undefined,
  path: string,
  description: string | undefined,
): SettingGroup {
  const title = titleOf(schema) ?? titleOf(inner) ?? humanize(path.split(".").at(-1) ?? path);
  return description ? { key: path, title, description } : { key: path, title };
}

/** The `.meta({ title })` of a schema, when it has one. */
function titleOf(schema: z.ZodType | undefined): string | undefined {
  const meta = (schema as { meta?: () => { title?: unknown } | undefined } | undefined)?.meta?.();
  return typeof meta?.title === "string" ? meta.title : undefined;
}

/** `coding_agents` -> "Coding agents"; a placeholder like `<name>` stays. */
function humanize(segment: string): string {
  if (segment.startsWith("<")) return segment;
  const words = segment.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What a user-chosen key in a record is called, so nested records stay readable. */
function recordPlaceholder(path: string): string {
  const lastKey = path.split(".").at(-1) ?? "";
  return lastKey === "env" ? "<var>" : "<name>";
}

/** The schema under its wrappers, with the outermost description along the way. */
function unwrap(schema: z.ZodType | undefined): {
  schema: z.ZodType | undefined;
  description?: string;
} {
  let current = schema;
  let description = schema?.description;
  for (let guard = 0; guard < 10 && current; guard++) {
    const def = zodDef(current);
    // z.preprocess(...) is a pipe: the validated schema is its output side.
    const inner = def?.innerType ?? (def?.type === "pipe" ? def.out : undefined);
    if (inner === undefined) break;
    current = inner;
    description = description ?? current.description;
  }
  return { schema: current, description };
}

/** True when the schema is a hex color, however often it is wrapped in optional/default. */
function isHexColor(schema: z.ZodType | undefined): boolean {
  let current = schema;
  for (let guard = 0; guard < 10 && current; guard++) {
    if (current === hexColorSchema) return true;
    current = zodDef(current)?.innerType;
  }
  return false;
}

/** The value under a dotted key in a nested object; undefined when the path leads nowhere. */
export function valueAt(tree: unknown, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function defaultFor(path: string, options: DescribeSettingsOptions): SettingDefault {
  const fromTree = (tree: unknown): string | undefined => {
    const value = valueAt(tree, path);
    return typeof value === "string" ? value : undefined;
  };
  const base = fromTree(options.defaults);
  const perOs: Record<string, string> = {};
  for (const [os, tree] of Object.entries(options.platformOverrides)) {
    const value = fromTree(tree);
    if (value !== undefined && value !== base) perOs[os] = value;
  }
  return { ...(base !== undefined ? { base } : {}), perOs };
}
