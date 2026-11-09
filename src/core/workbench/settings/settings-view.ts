import { UNLIMITED } from "@cogno/core/api/contributions/limit-setting";
import {
  defaultOn,
  SettingControl,
  SettingDescriptor,
  SettingGroup,
  valueAt,
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
  /** Key, description, section and group descriptions, lowercased once for the search. */
  readonly searchText: string;
};

/** A row as the panel shows it, with the headings it opens. */
export type ShownSettingRow = SettingRow & { readonly headings: ReadonlyArray<SettingHeading> };

export type SettingsView = {
  readonly sections: ReadonlyArray<{ readonly title: string; readonly count: number }>;
  readonly rows: ReadonlyArray<ShownSettingRow>;
  /** A query is set: the rows come from every section, each headed by its section. */
  readonly searching: boolean;
};

export type SettingHeading = {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  /** 0 is a section (only while searching), 1 the outermost group inside it, and so on. */
  readonly level: number;
};

export type SettingRowsInput = {
  readonly descriptors: ReadonlyArray<SettingDescriptor>;
  readonly configuration: Readonly<Record<string, unknown>> | undefined;
  readonly userKeys: ReadonlySet<string>;
  readonly platform: string;
};

export type SettingsViewFilter = {
  /** The section shown; ignored while `query` is set. */
  readonly section: string;
  readonly query: string;
};

/** Every row with its value; changes only when the config or the user's keys do. */
export function buildSettingRows(input: SettingRowsInput): SettingRow[] {
  return collapseRecords(input.descriptors).map((descriptor) => toRow(descriptor, input));
}

/** What the panel shows for a section or a query, headings included. */
export function buildSettingsView(
  rows: ReadonlyArray<SettingRow>,
  filter: SettingsViewFilter,
): SettingsView {
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const matching = searching
    ? rows.filter((row) => terms.every((term) => row.searchText.includes(term)))
    : rows;
  // Sections in the order the rows come in, which is the schema's.
  const counts = new Map<string, number>();
  for (const row of matching) counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
  const sections = [...counts].map(([title, count]) => ({ title, count }));
  const shown = searching ? matching : matching.filter((row) => row.section === filter.section);
  return { sections, rows: withHeadings(shown, searching), searching };
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

function toRow(descriptor: SettingDescriptor, input: SettingRowsInput): SettingRow {
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
    searchText: [
      descriptor.key,
      descriptor.description,
      descriptor.section,
      ...descriptor.groups.map((group) => group.description),
    ]
      .join(" ")
      .toLowerCase(),
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

/**
 * The headings each row opens, in order: its section while searching, then
 * every group it enters that the previous row was not in. A group with a
 * single shown setting gets no heading of its own - the setting says it all.
 */
function withHeadings(rows: ReadonlyArray<SettingRow>, searching: boolean): ShownSettingRow[] {
  const settingsPerGroup = new Map<string, number>();
  for (const row of rows) {
    for (const group of row.groups) {
      settingsPerGroup.set(group.key, (settingsPerGroup.get(group.key) ?? 0) + 1);
    }
  }
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const newSection = row.section !== previous?.section;
    const headings: SettingHeading[] = [];
    if (searching && newSection) headings.push({ key: "", title: row.section, level: 0 });
    const previousKeys = new Set((previous?.groups ?? []).map((group) => group.key));
    row.groups.forEach((group, depth) => {
      // The outermost group is the section itself; its name is already on the left.
      if (depth === 0) return;
      if (!newSection && previousKeys.has(group.key)) return;
      if ((settingsPerGroup.get(group.key) ?? 0) < 2) return;
      headings.push({
        key: group.key,
        title: group.title,
        ...(group.description ? { description: group.description } : {}),
        level: depth,
      });
    });
    return { ...row, headings };
  });
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
      if (trimmed === UNLIMITED) return { value: UNLIMITED };
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
