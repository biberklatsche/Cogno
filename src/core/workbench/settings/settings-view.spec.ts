import { SettingDescriptor } from "@cogno/core/infrastructure/config/config-schema-walker";
import { describe, expect, it } from "vitest";
import {
  buildSettingRows,
  buildSettingsView,
  parseInput,
  renderValue,
  SettingRowsInput,
  SettingsViewFilter,
  sectionOfKey,
  splitAtBackticks,
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

const view = (input: SettingRowsInput & SettingsViewFilter) => {
  const shown = buildSettingsView(buildSettingRows(input), input);
  return { ...shown, rows: shown.blocks.flatMap((block) => block.rows) };
};

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
    // In the order the rows come in, which is the schema's.
    expect(shown.sections).toEqual([
      { title: "Terminal", count: 1 },
      { title: "Font", count: 1 },
      { title: "Shell", count: 1 },
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

describe("blocks", () => {
  const group = (key: string) => ({
    key,
    title: key.split(".").at(-1)?.toUpperCase() ?? key,
    description: `${key} described`,
  });
  const setting = (key: string) => {
    const parts = key.split(".");
    return descriptor({
      key,
      section: "Notifications",
      groups: parts.slice(0, -1).map((_, index) => group(parts.slice(0, index + 1).join("."))),
    });
  };
  const notifications = (query: string) =>
    view({
      descriptors: [
        setting("n.channel.app.enabled"),
        setting("n.channel.app.duration"),
        setting("n.channel.os.enabled"),
        setting("n.channel.badge.enabled"),
        setting("n.source.agents.working.enabled"),
        setting("n.source.agents.ready.enabled"),
      ],
      configuration: {},
      userKeys: new Set(),
      platform: "linux",
      section: "Notifications",
      query,
    }).blocks.map((block) => ({ ...block, rows: block.rows.map((row) => row.key) }));

  it("puts the rows of the innermost group with several settings into one titled block", () => {
    expect(notifications("")[0]).toEqual({
      key: "n.channel.app.enabled",
      headings: [
        { key: "n.channel", title: "CHANNEL", description: "n.channel described", level: 1 },
      ],
      grouped: true,
      groupKey: "n.channel.app",
      title: "APP",
      description: "n.channel.app described",
      rows: ["n.channel.app.enabled", "n.channel.app.duration"],
    });
  });

  it("keeps settings that stand alone in their group out of the block before them", () => {
    expect(notifications("")[1]).toEqual({
      key: "n.channel.os.enabled",
      headings: [],
      grouped: true,
      groupKey: "n.channel",
      rows: ["n.channel.os.enabled", "n.channel.badge.enabled"],
    });
  });

  it("opens the next group of groups with its own heading", () => {
    expect(notifications("")[2]).toEqual({
      key: "n.source.agents.working.enabled",
      headings: [{ key: "n.source", title: "SOURCE", description: "n.source described", level: 1 }],
      grouped: true,
      groupKey: "n.source.agents",
      title: "AGENTS",
      description: "n.source.agents described",
      rows: ["n.source.agents.working.enabled", "n.source.agents.ready.enabled"],
    });
  });

  it("leaves rows in no named group ungrouped", () => {
    expect(view(input).blocks).toEqual([
      expect.objectContaining({ key: "terminal.webgl", grouped: false, headings: [] }),
    ]);
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

describe("sectionOfKey", () => {
  it("finds the section of a top-level key, and none for a key no setting has", () => {
    expect(sectionOfKey(descriptors, "font")).toBe("Font");
    expect(sectionOfKey(descriptors, "fon")).toBeUndefined();
  });
});

describe("splitAtBackticks", () => {
  it("sets the text between backticks apart as code", () => {
    expect(splitAtBackticks("Use `ask` or `deny`.")).toEqual([
      { text: "Use ", code: false },
      { text: "ask", code: true },
      { text: " or ", code: false },
      { text: "deny", code: true },
      { text: ".", code: false },
    ]);
  });

  it("leaves an unpaired backtick as text", () => {
    expect(splitAtBackticks("a ` b")).toEqual([{ text: "a ` b", code: false }]);
  });
});
