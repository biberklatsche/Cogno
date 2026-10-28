import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigSchema } from "./config-schema";
import {
  controlLabel,
  defaultOn,
  describeSettings,
  SETTING_SECTIONS,
  SettingDescriptor,
} from "./config-schema-walker";
import { featureSettingsExtensionFixture } from "./feature-settings.extension.fixture";
import { defaultSettings, platformSettingOverrides } from "./models/default-config-values";
import { notificationSourcesFixture } from "./notification-sources.fixture";

const schema = createConfigSchema([featureSettingsExtensionFixture], notificationSourcesFixture);
const settings = describeSettings(schema.shape, {
  defaults: defaultSettings,
  platformOverrides: platformSettingOverrides,
});
const byKey = new Map(settings.map((setting) => [setting.key, setting]));
const setting = (key: string): SettingDescriptor => {
  const found = byKey.get(key);
  if (!found) throw new Error(`no descriptor for ${key}`);
  return found;
};

describe("describeSettings", () => {
  it("names every top-level key of the schema in a section", () => {
    const sectioned = new Set(SETTING_SECTIONS.flatMap((section) => section.keys));
    for (const key of Object.keys(schema.shape)) {
      expect(sectioned.has(key), `section for ${key}`).toBe(true);
    }
  });

  it("describes every setting the shipped defaults name", () => {
    const defaults = readFileSync(
      join(process.cwd(), "src-tauri", "src", "default_windows.config"),
      "utf-8",
    );
    const keys = defaults
      .split("\n")
      .map((line) => /^([A-Za-z0-9_.]+)\s*=/.exec(line)?.[1])
      .filter((key): key is string => !!key && key !== "keybind");
    // A key inside a user-named record (`shell.profiles.zsh.path`) is described under `<name>`.
    const patterns = settings.map((entry) => ({
      entry,
      pattern: new RegExp(`^${entry.key.replace(/\./g, "\\.").replace(/<name>|<var>/g, "[^.]+")}$`),
    }));
    for (const key of keys) {
      const described = byKey.get(key) ?? patterns.find(({ pattern }) => pattern.test(key))?.entry;
      expect(described, key).toBeDefined();
      expect(described?.description, `description of ${key}`).not.toBe("");
    }
  });

  it("derives the control from the Zod definition", () => {
    expect(setting("cursor.blink").control).toEqual({ kind: "boolean" });
    expect(setting("font.size").control).toMatchObject({ kind: "number" });
    expect(setting("notification.channel.app.duration_seconds").control).toEqual({
      kind: "limit",
      min: 0,
    });
    expect(setting("color.background").control).toEqual({ kind: "string", hexColor: true });
    expect(setting("terminal.history.allowed_return_codes").control).toEqual({
      kind: "list",
      item: { kind: "number", integer: true },
    });
    expect(setting("keybind").control).toEqual({ kind: "file-only", type: "keybind lines" });
  });

  it("marks what lives in a user-named record", () => {
    const path = setting("shell.profiles.<name>.path");
    expect(path.record).toBe("shell.profiles");
    expect(path.section).toBe("Shell");
    expect(setting("cursor.blink").record).toBeUndefined();
  });

  it("carries the groups above a setting, named by meta title or key", () => {
    const groups = setting("notification.channel.os.enabled").groups;
    expect(groups.map((group) => group.key)).toEqual([
      "notification",
      "notification.channel",
      "notification.channel.os",
    ]);
    expect(groups.map((group) => group.title)).toEqual([
      "Notification",
      "Channels",
      "Operating system",
    ]);
    expect(groups[1]?.description).toBe("Where notifications are delivered.");
    expect(setting("feature.git.mode").groups.at(-1)?.title).toBe("Git");
  });

  it("resolves the default per platform", () => {
    const webgl = setting("terminal.webgl");
    expect(defaultOn(webgl, "windows")).toBe("true");
    expect(defaultOn(webgl, "linux")).toBe("false");
    expect(webgl.default.perOs).toEqual({ linux: "false" });
  });
});

describe("controlLabel", () => {
  it("prints the type the way the reference does", () => {
    expect(controlLabel({ kind: "number", integer: true, min: 0 })).toBe("integer ≥ 0");
    expect(controlLabel({ kind: "enum", values: ["on", "off"] })).toBe("`on` | `off`");
    expect(controlLabel({ kind: "limit", min: 0 })).toBe("`unlimited` | integer ≥ 0");
    expect(controlLabel({ kind: "list", item: { kind: "string", hexColor: false } })).toBe(
      "string[]",
    );
  });
});
