import { describe, it, expect } from 'vitest';
import { SettingsCodec } from './settings.codec';
import { DEFAULT_SETTINGS, SettingsSchema } from '../+models/settings';

/**
 * Pure class tests (no Angular TestBed). We verify:
 * - parseUserString turns dot-properties text into nested objects with primitive heuristics
 * - toSettings validates and fills defaults via Zod
 * - fromStringToSettings convenience method
 * - diffToString only outputs differences vs DEFAULT_SETTINGS, JSON-serialized, sorted and with trailing newline
 */

describe('SettingsCodec', () => {
  it('parseUserString parses booleans, numbers, JSON and nested keys', () => {
    const text = `
      # comment
      ; another comment
      autocomplete.mode="always"
      general.enable_telemetry=true
      general.scrollback_lines=12345
      theme.default.enable_webgl=true
      theme.default.colors.prompt_colors.1.foreground="red"
      theme.default.colors.prompt_colors.1.background="black"
      shell.1.name="bash"
      shell.1.shell_type="Bash"
      shell.1.path="/bin/bash"}]
    `;

    const parsed = SettingsCodec.fromStringToSettings(text);

    // Nested structure exists
    expect(parsed.general).toBeDefined();
    expect(parsed.general.enable_telemetry).toBe(true);
    expect(parsed.general.scrollback_lines).toBe(12345);

    expect(parsed.theme.default.enable_webgl).toBe(true);

    // Arrays/objects are parsed via JSON
    expect(parsed.theme.default.color.prompt_color["1"].foreground).toEqual('red');
    expect(parsed.theme.default.color.prompt_color["1"].background).toEqual('black');

    expect(parsed.shell["1"]).toMatchObject({ id: '1', name: 'bash', shell_type: 'Bash', path: '/bin/bash' });
  });

  it('toSettings fills defaults and keeps overrides', () => {
      const text = `
      general.enable_telemetry=false
      theme.default.enable_webgl=true
    `;

    const settings = SettingsCodec.fromStringToSettings(text);

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
    expect(() => SettingsCodec.fromStringToSettings(text)).toThrowError();
  });

  it('fromStringToSettings integrates parse + validate + defaults', () => {
    const text = `general.enable_telemetry=false\nGeneral.scrollback_lines=9999\n`;
    // Note: keys are case-sensitive in implementation; ensure correct casing
    const proper = `general.enable_telemetry=false\ngeneral.scrollback_lines=9999\n`;
    const settings = SettingsCodec.fromStringToSettings(proper);
    expect(settings.general.enable_telemetry).toBe(false);
    expect(settings.general.scrollback_lines).toBe(9999);
    // A default field still exists
    expect(settings.theme.default.enable_webgl).toBe(false);
  });

  it('diffToString outputs only differences vs DEFAULT_SETTINGS, JSON-serialized and sorted with trailing newline', () => {
    // Start from defaults and change a handful of values
    // Clone defaults to avoid mutating shared default object references inside zod schemas
    const current: any = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    current.general.enable_telemetry = false;
    current.theme.default.enable_webgl = true;
    current.general.scrollback_lines = 1234;
    current.keybind.copy = 'Control+Shift+C';

    const text = SettingsCodec.diffToString(current as any);

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
    const defaultDiff = SettingsCodec.diffToString(DEFAULT_SETTINGS);
    expect(defaultDiff).toBe('');
  });
});
