import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { defaultFeatureSettingsExtension } from "@cogno/features/feature-settings-extension";
import { ConfigReader } from "./config.reader";

const extensions = [defaultFeatureSettingsExtension];
let defaultText = "";
let DEFAULTS: any;

beforeAll(() => {
  const p = path.join(process.cwd(), "src-tauri", "src", "default_windows.config");
  defaultText = fs.readFileSync(p, "utf-8");
  DEFAULTS = ConfigReader.fromStringToConfig(defaultText, "", extensions);
});

describe("ConfigReader", () => {
  it("parses booleans, numbers, arrays and merges defaults with user (keybind concatenated)", () => {
    const text = `
      # comment
      ; another comment
      terminal.webgl=true
      scrollbar.scrollback_lines=12345
      cursor.blink=false
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/bash
      shell.profiles.default.args=[--login,"-i"]
      keybind=Ctrl+5=run5
    `;

    const parsed = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Basic values
    expect(parsed.terminal?.webgl).toBe(true);
    expect(parsed.scrollbar?.scrollback_lines).toBe(12345);
    expect(parsed.cursor?.blink).toBe(false);

    // Array parsing (non-keybind arrays are replaced)
    expect(parsed.shell?.profiles.default?.args).toEqual(["--login", "-i"]);

    // Keybind array concatenates: defaults first, then user values
    const defaultKeybindCount = DEFAULTS.keybind.length;
    expect(parsed.keybind?.length).toBe(defaultKeybindCount + 1);
    expect(parsed.keybind?.[defaultKeybindCount]).toBe("Ctrl+5=run5");
  });

  it("fills defaults from default config and keeps overrides", () => {
    const text = `
      terminal.webgl=true
    `;

    const settings = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Override applied
    expect(settings.terminal?.webgl).toBe(true);

    // Defaults from default file are present
    expect(settings.scrollbar?.scrollback_lines).toBe(100000);
    expect(settings.font?.size).toBe(14);
  });

  it("collects errors on invalid values (e.g., negative scrollback_lines) and ignores them", () => {
    const text = `
      scrollbar.scrollback_lines=-1
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
    expect(result.config.scrollbar?.scrollback_lines).toBe(100000);
  });

  it("ignores unknown settings and reports warnings", () => {
    const text = `
      unknown_key=123
      font.size=13
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);
    expect(result.config.font?.size).toBe(13);
    expect(result.diagnostics.some((d) => d.level === "warning")).toBe(true);
  });

  it("single-arg overload still works (no defaults)", () => {
    const proper = `terminal.webgl=false\nscrollbar.scrollback_lines=9999\n`;
    const settings = ConfigReader.fromStringToConfig(proper, extensions);
    expect(settings.terminal?.webgl).toBe(false);
    expect(settings.scrollbar?.scrollback_lines).toBe(9999);
  });

  it("keybind array is concatenated with defaults (defaults first, then user values)", () => {
    const text = `
      keybind=Ctrl+5=custom1
      keybind=Ctrl+6=custom2
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // User keybinds should be appended to defaults
    const defaultKeybindCount = DEFAULTS.keybind.length;
    expect(config.keybind?.length).toBe(defaultKeybindCount + 2);

    // First entries should be defaults
    expect(config.keybind?.[0]).toBe(DEFAULTS.keybind[0]);

    // Last entries should be user-provided
    expect(config.keybind?.[defaultKeybindCount]).toBe("Ctrl+5=custom1");
    expect(config.keybind?.[defaultKeybindCount + 1]).toBe("Ctrl+6=custom2");
  });

  it("shell args array is replaced, not concatenated", () => {
    const text = `
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/test
      shell.profiles.default.args=[--custom,--args]
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Shell args should be replaced, not concatenated with defaults
    expect(config.shell?.profiles.default?.args).toEqual(["--custom", "--args"]);
    expect(config.shell?.profiles.default?.args?.length).toBe(2);
  });

  it("empty array [] is parsed correctly, not as [undefined]", () => {
    const text = `
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/test
      shell.profiles.default.args=[]
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Empty array should be [], not [undefined]
    expect(config.shell?.profiles.default?.args).toEqual([]);
    expect(config.shell?.profiles.default?.args?.length).toBe(0);
  });

  it("adds platform-specific font fallbacks to font.family", () => {
    const text = `
      font.family=monospace
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Font should have fallbacks added
    expect(config.font?.family).toContain("monospace");
    expect(config.font?.family).toContain("ui-monospace");
    expect(config.font?.family).toMatch(/monospace.*ui-monospace|ui-monospace.*monospace/);
  });

  it("handles font names with spaces in fallback list", () => {
    const text = `
      font.family=Fira Code
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text, extensions);

    // Font name with spaces should be preserved without quotes
    expect(config.font?.family).toMatch(/^Fira Code,/);
    expect(config.font?.family).toContain("ui-monospace");
  });

  it("parses notification channels and overview settings", () => {
    const text = `
      notifications.app.available=true
      notifications.app.enabled=true
      notifications.app.duration_seconds=7
      notifications.os.available=true
      notifications.os.enabled=false
      notification.highlight_terminal_on_activity=false
      notification.long_running_commands.enabled=true
      notification.long_running_commands.minimum_duration_seconds=15
      notification.overview.max_items=42
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);

    expect(result.diagnostics.length).toBe(0);
    expect(result.config.notifications?.app?.available).toBe(true);
    expect(result.config.notifications?.app?.enabled).toBe(true);
    expect(result.config.notifications?.app?.duration_seconds).toBe(7);
    expect(result.config.notifications?.os?.available).toBe(true);
    expect(result.config.notifications?.os?.enabled).toBe(false);
    expect(result.config.notification?.highlight_terminal_on_activity).toBe(false);
    expect(result.config.notification?.long_running_commands?.enabled).toBe(true);
    expect(result.config.notification?.long_running_commands?.minimum_duration_seconds).toBe(15);
    expect(result.config.notification?.overview?.max_items).toBe(42);
  });

  it("parses search color settings", () => {
    const text = `
      search.match.background_color=2f8fda55
      search.active_match.border_color=f5e663
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);

    expect(result.diagnostics.length).toBe(0);
    expect(result.config.search?.match?.background_color).toBe("2f8fda55");
    expect(result.config.search?.active_match?.border_color).toBe("f5e663");
  });

  it("parses numeric-looking hex color settings as strings", () => {
    const text = `
      color.background=050505
      color.black=123456
      scrollbar.slider_hover_color=123456
      selection.background_color=12345678
      search.match.border_color=123
      prompt.segment.user.background=050505
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);

    expect(result.diagnostics.length).toBe(0);
    expect(result.config.color?.background).toBe("050505");
    expect(result.config.color?.black).toBe("123456");
    expect(result.config.scrollbar?.slider_hover_color).toBe("123456");
    expect(result.config.selection?.background_color).toBe("12345678");
    expect(result.config.search?.match?.border_color).toBe("123");
    expect(result.config.prompt?.segment.user?.background).toBe("050505");
  });

  it("parses terminal progress bar visibility setting", () => {
    const text = `
      terminal.progress_bar.enabled=false
    `;
    const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text, extensions);

    expect(result.diagnostics.length).toBe(0);
    expect(result.config.terminal?.progress_bar?.enabled).toBe(false);
  });
});
