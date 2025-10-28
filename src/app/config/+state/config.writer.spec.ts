import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../+models/config';
import { ConfigWriter } from './config.writer';

describe('ConfigWriter', () => {
  it('defaultSettingsAsComment includes # comment lines', () => {
    const text = ConfigWriter.defaultSettingsAsComment();
    const lines = text.split('\n');
    expect(lines.some(l => l.startsWith('# Test'))).toBe(true);
    expect(lines.every(l => (l.length > 0 ? l.startsWith('#') : true))).toBe(true);
  });

  it('diffToString does not emit any comments', () => {
    // Change some values to produce a diff
    const curr: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    curr.general.enable_telemetry = false;
    curr.general.scrollback_lines = 1234;
    curr.theme.default.enable_webgl = true;

    const diff = ConfigWriter.diffToString(curr);
    const diffLines = diff.trimEnd().split('\n');
    // Ensure no comment lines are present
    expect(diffLines.some(l => l.startsWith('#'))).toBe(false);
  });

  it('diffToString outputs only differences vs DEFAULT_SETTINGS, JSON-serialized and sorted with trailing newline', () => {
    // Start from defaults and change a handful of values
    // Clone defaults to avoid mutating shared default object references inside zod schemas
    const current: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    current.general.enable_telemetry = false;
    current.theme.default.enable_webgl = true;
    current.general.scrollback_lines = 1234;
    current.keybind = ['Control+Shift+C=copy', 'Shift+End=select_text_to_start_of_line'];

    const text = ConfigWriter.diffToString(current as any);

    // Should contain exactly these keys in sorted order and JSON-serialized values
    const expectedLines = [
      'general.enable_telemetry=false',
      'general.scrollback_lines=1234',
      'keybind=Control+Shift+C=copy',
      'keybind=Shift+End=select_text_to_start_of_line',
      'theme.default.enable_webgl=true',
    ].sort((a, b) => a.localeCompare(b));

    const lines = text.trimEnd().split('\n');
    expect(lines).toEqual(expectedLines);

    // trailing newline is present according to implementation
    expect(text.endsWith('\n')).toBe(true);

    // Ensure defaults produce empty diff
    const defaultDiff = ConfigWriter.diffToString(DEFAULT_CONFIG);
    expect(defaultDiff).toBe('');
  });
  it('renders non-keybind arrays as comma-separated without quotes, but keybind stays multiline', () => {
    const curr: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    // change shell args (array) and add a couple keybinds
    curr.shell[1] = curr.shell[1] || { name: 'Test', shell_type: 'Bash', path: '/bin/bash', args: [] };
    curr.shell[1].args = ['--login', '-i'];
    curr.keybind = ['Ctrl+A=doA', 'Shift+End=doB'];

    const diff = ConfigWriter.diffToString(curr);
    const lines = diff.trimEnd().split('\n');

    // Non-keybind array should be single line comma separated without quotes
    expect(lines).toContain('shell.1.args=[--login,-i]');

    // Keybind should be emitted as multiple lines (two separate entries)
    expect(lines).toContain('keybind=Ctrl+A=doA');
    expect(lines).toContain('keybind=Shift+End=doB');
  });
});
