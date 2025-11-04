import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigWriter } from './config.writer';
import { ConfigReader } from './config.reader';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {ConfigTypes} from "../+models/config.types";

let defaultText = '';
let DEFAULTS: ConfigTypes;

beforeAll(() => {
  const p = join(process.cwd(), 'src-tauri', 'src', 'default_windows.config');
  defaultText = readFileSync(p, 'utf-8');
  // Parse defaults from text (no user overrides)
  DEFAULTS = ConfigReader.fromStringToConfig(defaultText, '');
});

describe('ConfigWriter', () => {

  it('toDotString can render without comments when asComments=false', () => {
    const curr: ConfigTypes = JSON.parse(JSON.stringify(DEFAULTS));
    curr.enable_webgl = true;
    curr.scrollback_lines = 1234;

    const text = ConfigWriter.toDotString(curr, false);
    const lines = text.trimEnd().split('\n');

    // Ensure no comment lines are present
    expect(lines.some(l => l.startsWith('#'))).toBe(false);

    // Contains some expected values
    expect(lines).toContain('enable_webgl=true');
    expect(lines).toContain('scrollback_lines=1234');

    // trailing newline is present according to implementation
    expect(text.endsWith('\n')).toBe(true);
  });

  it('renders non-keybind arrays as comma-separated without quotes, but keybind stays multiline', () => {
    const curr: any = JSON.parse(JSON.stringify(DEFAULTS));
    // change shell args (array) and add a couple keybinds
    curr.shell = curr.shell || {};
    curr.shell[1] = curr.shell[1] || { shell_type: 'Bash', path: '/bin/bash', args: [] };
    curr.shell[1].args = ['--login', '-i'];
    curr.keybind = ['Ctrl+A=doA', 'Shift+End=doB'];

    const text = ConfigWriter.toDotString(curr, false);
    const lines = text.trimEnd().split('\n');

    // Non-keybind array should be single line comma separated without quotes
    expect(lines).toContain('shell.1.args=[--login,-i]');

    // Keybind should be emitted as multiple lines (two separate entries)
    expect(lines).toContain('keybind=Ctrl+A=doA');
    expect(lines).toContain('keybind=Shift+End=doB');
  });
});
