import { SettingDescriptor } from "@cogno/core/infrastructure/config/config-schema-walker";
import { describe, expect, it } from "vitest";
import {
  buildSettingRows,
  buildSettingsView,
  parseInput,
  renderValue,
  SettingRowsInput,
  SettingsViewFilter,
} from "./settings-view";

const descriptor = (partial: Partial<SettingDescriptor> & { key: string }): SettingDescriptor => ({
  section: "Terminal",
  groups: [],
  description: `${partial.key} described`,
  control: { kind: "boolean" },
  default: { base: "true", perOs: {} },
  ...partial,
});

const descriptors: SettingDescriptor[] = [
  descriptor({ key: "terminal.webgl", default: { base: "true", perOs: { linux: "false" } } }),
  descriptor({
    key: "font.size",
    section: "Font",
    control: { kind: "number", integer: true },
    default: { base: "14", perOs: {} },
  }),
  descriptor({
    key: "shell.profiles.<name>.path",
    section: "Shell",
    record: "shell.profiles",
    groups: [{ key: "shell.profiles", title: "Profiles", description: "Your shell profiles." }],
    control: { kind: "string", hexColor: false },
  }),
  descriptor({
    key: "shell.profiles.<name>.args",
    section: "Shell",
    record: "shell.profiles",
    groups: [{ key: "shell.profiles", title: "Profiles", description: "Your shell profiles." }],
    control: { kind: "list", item: { kind: "string", hexColor: false } },
  }),
];

const input = {
  descriptors,
  configuration: { terminal: { webgl: true }, font: { size: 14 } },
  userKeys: new Set(["terminal.webgl"]),
  platform: "linux",
  section: "Terminal",
  query: "",
};

const view = (input: SettingRowsInput & SettingsViewFilter) =>
  buildSettingsView(buildSettingRows(input), input);

describe("buildSettingsView", () => {
  it("shows the chosen section with values, platform defaults and what the user set", () => {
    const shown = view(input);

    expect(shown.rows).toEqual([
      expect.objectContaining({
        key: "terminal.webgl",
        value: "true",
        default: "false",
        modified: true,
      }),
    ]);
    expect(shown.sections).toEqual([
      { title: "Font", count: 1 },
      { title: "Shell", count: 1 },
      { title: "Terminal", count: 1 },
    ]);
  });

  it("counts a line that repeats the default as unchanged", () => {
    const shown = view({
      ...input,
      userKeys: new Set(["terminal.webgl", "font.size"]),
      section: "Font",
    });
    expect(shown.rows[0]).toEqual(expect.objectContaining({ key: "font.size", modified: false }));
  });

  it("collapses a record into one row that points at the file", () => {
    const shown = view({ ...input, section: "Shell" });

    expect(shown.rows).toEqual([
      expect.objectContaining({
        key: "shell.profiles",
        description: "Your shell profiles.",
        control: { kind: "file-only", type: "map" },
      }),
    ]);
  });

  it("searches across sections by key, description and section", () => {
    expect(view({ ...input, query: "SIZE" }).rows.map((row) => row.key)).toEqual(["font.size"]);
    expect(view({ ...input, query: "shell" }).rows.map((row) => row.key)).toEqual([
      "shell.profiles",
    ]);
    expect(view({ ...input, query: "webgl font" }).rows).toEqual([]);
  });
});

describe("headings", () => {
  const group = (key: string) => ({
    key,
    title: key.split(".").at(-1)?.toUpperCase() ?? key,
    description: `${key} described`,
  });
  const notifications = (query: string) =>
    view({
      descriptors: [
        descriptor({
          key: "n.source.agents.working.enabled",
          section: "Notifications",
          groups: [
            group("n"),
            group("n.source"),
            group("n.source.agents"),
            group("n.source.agents.working"),
          ],
        }),
        descriptor({
          key: "n.source.agents.ready.enabled",
          section: "Notifications",
          groups: [
            group("n"),
            group("n.source"),
            group("n.source.agents"),
            group("n.source.agents.ready"),
          ],
        }),
        descriptor({
          key: "n.source.errors.handled.enabled",
          section: "Notifications",
          groups: [
            group("n"),
            group("n.source"),
            group("n.source.errors"),
            group("n.source.errors.handled"),
          ],
        }),
      ],
      configuration: {},
      userKeys: new Set(),
      platform: "linux",
      section: "Notifications",
      query,
    }).rows;

  it("opens the groups a row enters, stepped by depth, and skips groups of one setting", () => {
    const rows = notifications("");
    expect(rows[0]?.headings).toEqual([
      { key: "n.source", title: "SOURCE", description: "n.source described", level: 1 },
      {
        key: "n.source.agents",
        title: "AGENTS",
        description: "n.source.agents described",
        level: 2,
      },
    ]);
    expect(rows[1]?.headings).toEqual([]);
    expect(rows[2]?.headings).toEqual([]);
  });

  it("names the section first while searching", () => {
    expect(notifications("n.source")[0]?.headings[0]).toEqual({
      key: "",
      title: "Notifications",
      level: 0,
    });
  });
});

describe("parseInput", () => {
  it("reads what the person typed for the control", () => {
    expect(parseInput({ kind: "number", integer: true }, "12")).toEqual({ value: 12 });
    expect(parseInput({ kind: "number", integer: true }, "1.5")).toEqual({
      error: "A whole number",
    });
    expect(parseInput({ kind: "limit", min: 0 }, "unlimited")).toEqual({ value: "unlimited" });
    expect(parseInput({ kind: "enum", values: ["on", "off"] }, "maybe")).toEqual({
      error: "One of on, off",
    });
    expect(parseInput({ kind: "list", item: { kind: "number", integer: true } }, "0, 1")).toEqual({
      value: [0, 1],
    });
    expect(parseInput({ kind: "file-only", type: "map" }, "x")).toEqual({
      error: "Edit this in the settings file",
    });
  });
});

describe("renderValue", () => {
  it("spells a value the way the file does", () => {
    expect(renderValue(true)).toBe("true");
    expect(renderValue([0, 1])).toBe("0,1");
    expect(renderValue(undefined)).toBe("");
  });
});
