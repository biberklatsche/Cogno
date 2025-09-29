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
      
      general.enableTelemetry=false
      general.scrollbackLines=12345
      theme.default.enableWebgl=true
      theme.default.colors.promptColors=[{"foreground":"red","background":"black"}]
      shells=[{"id":"1","name":"bash","shellType":"Bash","path":"/bin/bash"}]
    `;

    const parsed = SettingsCodec.fromStringToSettings(text);

    // Nested structure exists
    expect(parsed.general).toBeDefined();
    expect(parsed.general.enableTelemetry).toBe(false);
    expect(parsed.general.scrollbackLines).toBe(12345);

    expect(parsed.theme.default.enableWebgl).toBe(true);

    // Arrays/objects are parsed via JSON
    expect(Array.isArray(parsed.theme.default.colors.promptColors)).toBe(true);
    expect(parsed.theme.default.colors.promptColors[0]).toEqual({ foreground: 'red', background: 'black' });

    expect(Array.isArray(parsed.shells)).toBe(true);
    expect(parsed.shells[0]).toMatchObject({ id: '1', name: 'bash', shellType: 'Bash', path: '/bin/bash' });
  });

  it('toSettings fills defaults and keeps overrides', () => {
      const text = `
      general.enableTelemetry=false
      theme.default.enableWebgl=true
    `;

    const settings = SettingsCodec.fromStringToSettings(text);

    // Overrides applied
    expect(settings.general.enableTelemetry).toBe(false);
    expect(settings.theme.default.enableWebgl).toBe(true);

    // Defaults filled by Zod (e.g., scrollbackLines has default 100000)
    expect(settings.general.scrollbackLines).toBeGreaterThan(0);
    expect(settings.general.scrollbackLines).toBe(100000);

    // Defaults for theme/defaults exist (e.g., cursor width default)
    expect(settings.theme.default.cursor.width).toBeDefined();
  });

  it('toSettings throws on invalid values (e.g., negative scrollbackLines)', () => {
      const text = `
      general.scrollbackLines=-1
    `;
    expect(() => SettingsCodec.fromStringToSettings(text)).toThrowError();
  });

  it('fromStringToSettings integrates parse + validate + defaults', () => {
    const text = `general.enableTelemetry=false\nGeneral.scrollbackLines=9999\n`;
    // Note: keys are case-sensitive in implementation; ensure correct casing
    const proper = `general.enableTelemetry=false\ngeneral.scrollbackLines=9999\n`;
    const settings = SettingsCodec.fromStringToSettings(proper);
    expect(settings.general.enableTelemetry).toBe(false);
    expect(settings.general.scrollbackLines).toBe(9999);
    // A default field still exists
    expect(settings.theme.default.enableWebgl).toBe(false);
  });

  it('diffToString outputs only differences vs DEFAULT_SETTINGS, JSON-serialized and sorted with trailing newline', () => {
    // Start from defaults and change a handful of values
    // Clone defaults to avoid mutating shared default object references inside zod schemas
    const current: any = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    current.general.enableTelemetry = false;
    current.theme.default.enableWebgl = true;
    current.general.scrollbackLines = 1234;
    current.shortcuts.copy = 'Control+Shift+C';

    const text = SettingsCodec.diffToString(current as any);

    // Should contain exactly these keys in sorted order and JSON-serialized values
    const expectedLines = [
      'general.enableTelemetry=false',
      'general.scrollbackLines=1234',
      'shortcuts.copy="Control+Shift+C"',
      'theme.default.enableWebgl=true',
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
