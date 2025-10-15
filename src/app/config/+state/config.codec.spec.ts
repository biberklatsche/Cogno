import { describe, it, expect } from 'vitest';
import { ConfigCodec } from './config.codec';
import { DEFAULT_CONFIG } from '../+models/config';

describe('ConfigCodec', () => {
  it('defaultsToStringWithComments includes # comment lines', () => {
    const text = ConfigCodec.defaultSettingsAsComment();
    const lines = text.split('\n');
    expect(lines.some(l => l.startsWith('# The name of the shell'))).toBe(true);
    expect(lines.every(l => l.length > 0 ? l.startsWith('#') : true)).toBe(true);
  });

  it('diffToString does not emit any comments', () => {
    // Change some values to produce a diff
    const curr: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    curr.general.enable_telemetry = false;
    curr.general.scrollback_lines = 1234;
    curr.theme.default.enable_webgl = true;

    const diff = ConfigCodec.diffToString(curr);
    const diffLines = diff.trimEnd().split('\n');
    // Ensure no comment lines are present
    expect(diffLines.some(l => l.startsWith('#'))).toBe(false);
  });
  it('parseUserString parses booleans, numbers, JSON and nested keys', () => {
    const text = `
      # comment
      ; another comment
      autocomplete.mode="always"
      general.enable_telemetry=true
      general.scrollback_lines=12345
      theme.default.enable_webgl=true
      theme.default.color.prompt.1.foreground="red"
      theme.default.color.prompt.1.background="black"
      shell.1.name="zsh"
      shell.1.shell_type="ZSH"
      shell.1.path="/bin/zsh"
    `;

    const parsed = ConfigCodec.fromStringToConfig(text);

    // Nested structure exists
    expect(parsed.general).toBeDefined();
    expect(parsed.general.enable_telemetry).toBe(true);
    expect(parsed.general.scrollback_lines).toBe(12345);

    expect(parsed.theme.default.enable_webgl).toBe(true);

    // Arrays/objects are parsed via JSON
    expect(parsed.theme.default.color.prompt["1"].foreground).toEqual('red');
    expect(parsed.theme.default.color.prompt["1"].background).toEqual('black');

    expect(parsed.shell["1"]!.name).toEqual('zsh');
    expect(parsed.shell["1"]!.shell_type).toEqual('ZSH');
    expect(parsed.shell["1"]!.path).toEqual('/bin/zsh');
    expect(parsed.shell["1"]!.use_conpty).toBe(true);
  });

  it('toSettings fills defaults and keeps overrides', () => {
      const text = `
      general.enable_telemetry=false
      theme.default.enable_webgl=true
    `;

    const settings = ConfigCodec.fromStringToConfig(text);

    // Overrides applied
    expect(settings.general.enable_telemetry).toBe(false);
    expect(settings.theme.default.enable_webgl).toBe(true);

    // Defaults filled by Zod (e.g., scrollback_lines has default 10000)
    expect(settings.general.scrollback_lines).toBeGreaterThan(0);
    expect(settings.general.scrollback_lines).toBe(10000);

    // Defaults for theme/defaults exist (e.g., cursor width default)
    expect(settings.theme.default.cursor.width).toBeDefined();
  });

  it('toSettings throws on invalid values (e.g., negative scrollback_lines)', () => {
      const text = `
      general.scrollback_lines=-1
    `;
    expect(() => ConfigCodec.fromStringToConfig(text)).toThrowError();
  });

  it('fromStringToSettings integrates parse + validate + defaults', () => {
    const text = `general.enable_telemetry=false\nGeneral.scrollback_lines=9999\n`;
    // Note: keys are case-sensitive in implementation; ensure correct casing
    const proper = `general.enable_telemetry=false\ngeneral.scrollback_lines=9999\n`;
    const settings = ConfigCodec.fromStringToConfig(proper);
    expect(settings.general.enable_telemetry).toBe(false);
    expect(settings.general.scrollback_lines).toBe(9999);
    // A default field still exists
    expect(settings.theme.default.enable_webgl).toBe(false);
  });

  it('diffToString outputs only differences vs DEFAULT_SETTINGS, JSON-serialized and sorted with trailing newline', () => {
    // Start from defaults and change a handful of values
    // Clone defaults to avoid mutating shared default object references inside zod schemas
    const current: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    current.general.enable_telemetry = false;
    current.theme.default.enable_webgl = true;
    current.general.scrollback_lines = 1234;
    current.keybind.copy = 'Control+Shift+C';

    const text = ConfigCodec.diffToString(current as any);

    // Should contain exactly these keys in sorted order and JSON-serialized values
    const expectedLines = [
      'general.enable_telemetry=false',
      'general.scrollback_lines=1234',
      'keybind.copy="Control+Shift+C"',
      'theme.default.enable_webgl=true',
    ].sort((a,b)=>a.localeCompare(b));

    const lines = text.trimEnd().split('\n');
    expect(lines).toEqual(expectedLines);

    // trailing newline is present according to implementation
    expect(text.endsWith('\n')).toBe(true);

    // Ensure defaults produce empty diff
    const defaultDiff = ConfigCodec.diffToString(DEFAULT_CONFIG);
    expect(defaultDiff).toBe('');
  });
});
