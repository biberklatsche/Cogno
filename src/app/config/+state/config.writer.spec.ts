import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigWriter } from './config.writer';
import { ConfigReader } from './config.reader';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {Config} from "../+models/config";

let defaultText = '';
let DEFAULTS: Config;

beforeAll(() => {
  const p = join(process.cwd(), 'src-tauri', 'src', 'default_windows.config');
  defaultText = readFileSync(p, 'utf-8');
  // Parse defaults from text (no user overrides)
  DEFAULTS = ConfigReader.fromStringToConfig(defaultText, '');
});

describe('ConfigWriter', () => {

  it('diffToString does not emit any comments', () => {
    // Change some values to produce a diff
    const curr: Config = JSON.parse(JSON.stringify(DEFAULTS));
    curr.enable_webgl = true;
    curr.scrollback_lines = 1234;

    const diff = ConfigWriter.diffToString(DEFAULTS, curr);
    const diffLines = diff.trimEnd().split('\n');
    // Ensure no comment lines are present
    expect(diffLines.some(l => l.startsWith('#'))).toBe(false);
  });

  it('diffToString outputs only differences vs defaults, JSON-serialized and sorted with trailing newline', () => {
    // Start from defaults and change a handful of values
    const current: any = JSON.parse(JSON.stringify(DEFAULTS));
    current.enable_webgl = true;
    current.scrollback_lines = 1234;
    current.keybind = ['Control+Shift+C=copy', 'Shift+End=select_text_to_start_of_line'];

    const text = ConfigWriter.diffToString(DEFAULTS as any, current as any);

    // Should contain exactly these keys in sorted order and JSON-serialized values
    const expectedLines = [
      'enable_webgl=true',
      'keybind=Control+Shift+C=copy',
      'keybind=Shift+End=select_text_to_start_of_line',
      'scrollback_lines=1234',
    ].sort((a, b) => a.localeCompare(b));

    const lines = text.trimEnd().split('\n');
    expect(lines).toEqual(expectedLines);

    // trailing newline is present according to implementation
    expect(text.endsWith('\n')).toBe(true);

    // Ensure defaults produce empty diff
    const defaultDiff = ConfigWriter.diffToString(DEFAULTS, DEFAULTS);
    expect(defaultDiff).toBe('');
  });
  it('renders non-keybind arrays as comma-separated without quotes, but keybind stays multiline', () => {
    const curr: any = JSON.parse(JSON.stringify(DEFAULTS));
    // change shell args (array) and add a couple keybinds
    curr.shell = curr.shell || {};
    curr.shell[1] = curr.shell[1] || { shell_type: 'Bash', path: '/bin/bash', args: [] };
    curr.shell[1].args = ['--login', '-i'];
    curr.keybind = ['Ctrl+A=doA', 'Shift+End=doB'];

    const diff = ConfigWriter.diffToString(DEFAULTS, curr);
    const lines = diff.trimEnd().split('\n');

    // Non-keybind array should be single line comma separated without quotes
    expect(lines).toContain('shell.1.args=[--login,-i]');

    // Keybind should be emitted as multiple lines (two separate entries)
    expect(lines).toContain('keybind=Ctrl+A=doA');
    expect(lines).toContain('keybind=Shift+End=doB');
  });
});
