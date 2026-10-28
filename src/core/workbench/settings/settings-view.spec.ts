import { SettingDescriptor } from "@cogno/core/infrastructure/config/config-schema-walker";
import { describe, expect, it } from "vitest";
import { buildSettingsView, headingsBefore, parseInput, renderValue } from "./settings-view";

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

describe("buildSettingsView", () => {
  it("shows the chosen section with values, platform defaults and what the user set", () => {
    const view = buildSettingsView(input);

    expect(view.rows).toEqual([
      expect.objectContaining({
        key: "terminal.webgl",
        value: "true",
        default: "false",
        modified: true,
      }),
    ]);
    expect(view.sections).toEqual([
      { title: "Font", count: 1 },
      { title: "Shell", count: 1 },
      { title: "Terminal", count: 1 },
    ]);
  });

  it("counts a line that repeats the default as unchanged", () => {
    const view = buildSettingsView({
      ...input,
      userKeys: new Set(["terminal.webgl", "font.size"]),
      section: "Font",
    });
    expect(view.rows[0]).toEqual(expect.objectContaining({ key: "font.size", modified: false }));
  });

  it("collapses a record into one row that points at the file", () => {
    const view = buildSettingsView({ ...input, section: "Shell" });

    expect(view.rows).toEqual([
      expect.objectContaining({
        key: "shell.profiles",
        description: "Your shell profiles.",
        control: { kind: "file-only", type: "map" },
      }),
    ]);
  });

  it("searches across sections by key, description and section", () => {
    expect(buildSettingsView({ ...input, query: "SIZE" }).rows.map((row) => row.key)).toEqual([
      "font.size",
    ]);
    expect(buildSettingsView({ ...input, query: "shell" }).rows.map((row) => row.key)).toEqual([
      "shell.profiles",
    ]);
    expect(buildSettingsView({ ...input, query: "webgl font" }).rows).toEqual([]);
  });
});

describe("headingsBefore", () => {
  const group = (key: string) => ({
    key,
    title: key.split(".").at(-1)?.toUpperCase() ?? key,
    description: `${key} described`,
  });
  const rows = buildSettingsView({
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
    query: "",
  }).rows;

  it("opens the groups a row enters, stepped by depth, and skips groups of one setting", () => {
    expect(headingsBefore(rows, 0, false)).toEqual([
      { key: "n.source", title: "SOURCE", description: "n.source described", level: 1 },
      {
        key: "n.source.agents",
        title: "AGENTS",
        description: "n.source.agents described",
        level: 2,
      },
    ]);
    expect(headingsBefore(rows, 1, false)).toEqual([]);
    expect(headingsBefore(rows, 2, false)).toEqual([]);
  });

  it("names the section first while searching", () => {
    expect(headingsBefore(rows, 0, true)[0]).toEqual({ key: "", title: "Notifications", level: 0 });
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
