import {
  defaultOn,
  SETTING_SECTIONS,
  SettingControl,
  SettingDescriptor,
  SettingGroup,
} from "@cogno/core/infrastructure/config/config-schema-walker";

/**
 * What the settings panel shows, computed from the schema's descriptors, the
 * loaded config and the keys the user's file sets. Pure: the component only
 * renders this and writes through the config service.
 */

export type SettingRow = {
  readonly key: string;
  readonly section: string;
  /** Headings above the row, outermost first; the panel prints those that changed since the previous row. */
  readonly groups: ReadonlyArray<SettingGroup>;
  readonly description: string;
  readonly control: SettingControl;
  /** The effective value as the file would spell it; "" when there is none. */
  readonly value: string;
  /** The default on this platform, as the file spells it. */
  readonly default: string | undefined;
  /** The user's file sets this key to something other than the default. */
  readonly modified: boolean;
};

export type SettingsView = {
  readonly sections: ReadonlyArray<{ readonly title: string; readonly count: number }>;
  readonly rows: ReadonlyArray<SettingRow>;
};

export type SettingHeading = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  /** 0 is a section (only while searching), 1 the outermost group inside it, and so on. */
  readonly level: number;
};

export type SettingsViewInput = {
  readonly descriptors: ReadonlyArray<SettingDescriptor>;
  readonly configuration: Readonly<Record<string, unknown>> | undefined;
  readonly userKeys: ReadonlySet<string>;
  readonly platform: string;
  /** The section shown; ignored while `query` is set. */
  readonly section: string;
  readonly query: string;
};

export function buildSettingsView(input: SettingsViewInput): SettingsView {
  const rows = collapseRecords(input.descriptors).map((descriptor) => toRow(descriptor, input));
  const terms = input.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = terms.length > 0 ? rows.filter((row) => matches(row, terms)) : rows;
  const sections = SETTING_SECTIONS.map((section) => ({
    title: section.title,
    count: matching.filter((row) => row.section === section.title).length,
  })).filter((section) => section.count > 0);
  const shown =
    terms.length > 0 ? matching : matching.filter((row) => row.section === input.section);
  return { sections, rows: shown };
}

/**
 * A map of user-named entries (`shell.profiles.<name>.*`) is one row the panel
 * cannot edit, in place of all the rows inside it: there is no entry to put a
 * value on until the person names one, and that happens in the file.
 */
function collapseRecords(descriptors: ReadonlyArray<SettingDescriptor>): SettingDescriptor[] {
  const out: SettingDescriptor[] = [];
  const seenRecords = new Set<string>();
  for (const descriptor of descriptors) {
    if (!descriptor.record) {
      out.push(descriptor);
      continue;
    }
    if (seenRecords.has(descriptor.record)) continue;
    seenRecords.add(descriptor.record);
    const recordGroup = descriptor.groups.find((group) => group.key === descriptor.record);
    out.push({
      key: descriptor.record,
      section: descriptor.section,
      groups: descriptor.groups.filter((group) => group.key !== descriptor.record),
      description: recordGroup?.description ?? descriptor.description,
      control: { kind: "file-only", type: "map" },
      default: { perOs: {} },
    });
  }
  return out;
}

function toRow(descriptor: SettingDescriptor, input: SettingsViewInput): SettingRow {
  const value = renderValue(valueAt(input.configuration, descriptor.key));
  const fallback = defaultOn(descriptor, input.platform);
  return {
    key: descriptor.key,
    section: descriptor.section,
    groups: descriptor.groups,
    description: descriptor.description,
    control: descriptor.control,
    value,
    default: fallback,
    // A line that merely repeats the default is not a change. The file's
    // presence still counts, because some effective values (a font family
    // with its fallbacks appended) never equal their default verbatim.
    modified: input.userKeys.has(descriptor.key) && !sameSpelling(value, fallback),
  };
}

/** Whether a value and a default mean the same thing; a list reads `[a,b]` in the defaults. */
function sameSpelling(value: string, fallback: string | undefined): boolean {
  if (fallback === undefined) return false;
  return (
    value.trim() ===
    fallback
      .trim()
      .replace(/^\[(.*)\]$/, "$1")
      .replace(/,\s+/g, ",")
  );
}

function matches(row: SettingRow, terms: ReadonlyArray<string>): boolean {
  const haystack = [
    row.key,
    row.description,
    row.section,
    ...row.groups.map((group) => group.description),
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * The headings a row opens, in order: its section while searching, then
 * every group it enters that the previous row was not in. A group with a
 * single setting gets no heading of its own - the setting says it all.
 */
export function headingsBefore(
  rows: ReadonlyArray<SettingRow>,
  index: number,
  searching: boolean,
): SettingHeading[] {
  const row = rows[index];
  if (!row) return [];
  const previous = rows[index - 1];
  const newSection = row.section !== previous?.section;
  const headings: SettingHeading[] = [];
  if (searching && newSection) headings.push({ key: "", title: row.section, level: 0 });
  const previousKeys = new Set((previous?.groups ?? []).map((group) => group.key));
  row.groups.forEach((group, depth) => {
    // The outermost group is the section itself; its name is already on the left.
    if (depth === 0) return;
    if (!newSection && previousKeys.has(group.key)) return;
    if (settingsIn(rows, group.key) < 2) return;
    headings.push({
      key: group.key,
      title: group.title,
      ...(group.description ? { description: group.description } : {}),
      level: depth,
    });
  });
  return headings;
}

function settingsIn(rows: ReadonlyArray<SettingRow>, groupKey: string): number {
  return rows.filter((row) => row.groups.some((group) => group.key === groupKey)).length;
}

/** The effective value under a dotted key; undefined when the path leads nowhere. */
export function valueAt(
  configuration: Readonly<Record<string, unknown>> | undefined,
  key: string,
): unknown {
  let node: unknown = configuration;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** A value the way the file spells it: `true`, `14`, `a,b` for a list. */
export function renderValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(",");
  if (typeof value === "object") return "";
  return String(value);
}

/**
 * What the person typed, as the value `update` expects for the control; a
 * message instead when it cannot be read. The schema still has the last word.
 */
export function parseInput(
  control: SettingControl,
  text: string,
): { readonly value: unknown } | { readonly error: string } {
  const trimmed = text.trim();
  switch (control.kind) {
    case "boolean":
      return { value: trimmed === "true" };
    case "enum":
      return control.values.includes(trimmed)
        ? { value: trimmed }
        : { error: `One of ${control.values.join(", ")}` };
    case "number": {
      const number = Number(trimmed);
      if (trimmed === "" || Number.isNaN(number)) return { error: "A number" };
      if (control.integer && !Number.isInteger(number)) return { error: "A whole number" };
      return { value: number };
    }
    case "limit": {
      if (trimmed === "unlimited") return { value: "unlimited" };
      const number = Number(trimmed);
      if (trimmed === "" || !Number.isInteger(number))
        return { error: "A whole number or unlimited" };
      return { value: number };
    }
    case "string":
      return { value: trimmed };
    case "list": {
      const items = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const parsed = items.map((item) => parseInput(control.item, item));
      const failed = parsed.find((item) => "error" in item);
      if (failed && "error" in failed) return { error: `Each entry: ${failed.error}` };
      return { value: parsed.map((item) => ("value" in item ? item.value : undefined)) };
    }
    case "file-only":
      return { error: "Edit this in the settings file" };
  }
}
