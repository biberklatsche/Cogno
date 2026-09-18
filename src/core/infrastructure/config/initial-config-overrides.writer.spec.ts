import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ConfigMapper } from "./config.mapper";
import { featureSettingsExtensionFixture } from "./feature-settings.extension.fixture";
import { InitialConfigOverridesWriter } from "./initial-config-overrides.writer";
import type { Config } from "./models/config";

const extensions = [featureSettingsExtensionFixture];
let defaultText = "";
let DEFAULTS: Config;

beforeAll(() => {
  const p = join(process.cwd(), "src-tauri", "src", "default_windows.config");
  defaultText = readFileSync(p, "utf-8");
  // Parse defaults from text (no user overrides)
  DEFAULTS = ConfigMapper.fromStringToConfig("linux", defaultText, "", extensions);
});

describe("InitialConfigOverridesWriter", () => {
  it("renders plain key = value lines without comments", () => {
    const curr: Config = JSON.parse(JSON.stringify(DEFAULTS));
    curr.terminal = { ...(curr.terminal ?? {}), webgl: true };
    if (!curr.scrollbar) curr.scrollbar = {};
    curr.scrollbar.scrollback_lines = 1234;

    const text = InitialConfigOverridesWriter.toDotString(curr);
    const lines = text.trimEnd().split("\n");

    // Ensure no comment lines are present
    expect(lines.some((l) => l.startsWith("#"))).toBe(false);

    // Contains some expected values
    expect(lines).toContain("terminal.webgl = true");
    expect(lines).toContain("scrollbar.scrollback_lines = 1234");

    // trailing newline is present according to implementation
    expect(text.endsWith("\n")).toBe(true);
  });

  it("writes only overrides compared to defaults", () => {
    const currentConfig: Config = JSON.parse(JSON.stringify(DEFAULTS));
    currentConfig.scrollbar = { ...(currentConfig.scrollbar ?? {}), scrollback_lines: 1234 };
    currentConfig.shell = {
      ...(currentConfig.shell ?? {}),
      default: "zsh",
      order: ["zsh"],
      profiles: {
        zsh: {
          shell_type: "ZSH",
          path: "/bin/zsh",
          args: [],
          env: {},
          working_dir: "~",
          load_user_rc: true,
          enable_shell_integration: true,
          inject_cogno_cli: true,
        },
      },
    };

    const text = InitialConfigOverridesWriter.toDotString(currentConfig, {
      defaultSettings: DEFAULTS,
    });

    expect(text).toContain("scrollbar.scrollback_lines = 1234");
    expect(text).toContain("shell.default = zsh");
    expect(text).not.toContain("font.family");
  });

  it("writes nothing when config matches defaults exactly", () => {
    const currentConfig: Config = JSON.parse(JSON.stringify(DEFAULTS));

    const text = InitialConfigOverridesWriter.toDotString(currentConfig, {
      defaultSettings: DEFAULTS,
    });

    expect(text).toBe("");
  });

  it("renders other arrays as comma-separated list", () => {
    const config = {
      some_array: [1, 2, "three"],
    } as any;
    const text = InitialConfigOverridesWriter.toDotString(config);
    expect(text).toContain("some_array = [1,2,three]");
  });

  it("handles complex nested objects", () => {
    const config = {
      a: {
        b: {
          c: 1,
        },
        d: 2,
      },
    } as any;
    const text = InitialConfigOverridesWriter.toDotString(config);
    const lines = text.trim().split("\n");
    expect(lines).toContain("a.b.c = 1");
    expect(lines).toContain("a.d = 2");
  });

  it("renders complex values via JSON.stringify", () => {
    const _config = {
      complex: { a: 1 },
    } as any;
    // We need to bypass the isPlainObject check for the leaf value to trigger renderValue with object
    // But toDotProperties recursion will treat it as plain object.
    // We can test renderValue directly.
    expect((InitialConfigOverridesWriter as any).renderValue({ a: 1 })).toBe('{"a":1}');
  });

  it("renders keybinds multiline", () => {
    const config = {
      keybind: ["a=b", "c=d"],
    } as any;
    const text = InitialConfigOverridesWriter.toDotString(config);
    expect(text).toContain("keybind = a=b\nkeybind = c=d");
  });

  it("renders terminal progress bar config", () => {
    const config = {
      terminal: {
        progress_bar: {
          enabled: false,
        },
      },
    } as any;
    const text = InitialConfigOverridesWriter.toDotString(config);
    expect(text).toContain("terminal.progress_bar.enabled = false");
  });
});
