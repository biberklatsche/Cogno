import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigReader } from './config.reader';
import fs from 'fs';
import path from 'path';

let defaultText = '';
let DEFAULTS: any;

beforeAll(() => {
  const p = path.join(process.cwd(), 'src-tauri', 'src', 'default_windows.config');
  defaultText = fs.readFileSync(p, 'utf-8');
  DEFAULTS = ConfigReader.fromStringToConfig(defaultText, '');
});

describe('ConfigReader', () => {
  it('parses booleans, numbers, arrays and merges defaults with user (keybind concatenated)', () => {
    const text = `
      # comment
      ; another comment
      enable_webgl=true
      scrollback_lines=12345
      cursor.blink=false
      shell.1.shell_type=Bash
      shell.1.path=/bin/bash
      shell.1.args=[--login,"-i"]
      keybind=Ctrl+5=run5
    `;

    const parsed = ConfigReader.fromStringToConfig(defaultText, text);

    // Basic values
    expect(parsed.enable_webgl).toBe(true);
    expect(parsed.scrollback_lines).toBe(12345);
    expect(parsed.cursor!.blink).toBe(false);

    // Array parsing (non-keybind arrays are replaced)
    expect(parsed.shell![1]?.args).toEqual(['--login', '-i']);

    // Keybind array concatenates: defaults first, then user values
    const defaultKeybindCount = DEFAULTS.keybind.length;
    expect(parsed.keybind!.length).toBe(defaultKeybindCount + 1);
    expect(parsed.keybind![defaultKeybindCount]).toBe('Ctrl+5=run5');
  });

  it('fills defaults from default config and keeps overrides', () => {
    const text = `
      enable_webgl=true
    `;

    const settings = ConfigReader.fromStringToConfig(defaultText, text);

    // Override applied
    expect(settings.enable_webgl).toBe(true);

    // Defaults from default file are present
    expect(settings.scrollback_lines).toBe(10000);
    expect(settings.font!.size).toBe(14);
  });

  it('throws on invalid values (e.g., negative scrollback_lines)', () => {
    const text = `
      scrollback_lines=-1
    `;
    expect(() => ConfigReader.fromStringToConfig(defaultText, text)).toThrowError();
  });

  it('single-arg overload still works (no defaults)', () => {
    const proper = `enable_webgl=false\nscrollback_lines=9999\n`;
    const settings = ConfigReader.fromStringToConfig(proper);
    expect(settings.enable_webgl).toBe(false);
    expect(settings.scrollback_lines).toBe(9999);
  });

  it('keybind array is concatenated with defaults (defaults first, then user values)', () => {
    const text = `
      keybind=Ctrl+5=custom1
      keybind=Ctrl+6=custom2
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text);
    
    // User keybinds should be appended to defaults
    const defaultKeybindCount = DEFAULTS.keybind.length;
    expect(config.keybind!.length).toBe(defaultKeybindCount + 2);
    
    // First entries should be defaults
    expect(config.keybind![0]).toBe(DEFAULTS.keybind[0]);
    
    // Last entries should be user-provided
    expect(config.keybind![defaultKeybindCount]).toBe('Ctrl+5=custom1');
    expect(config.keybind![defaultKeybindCount + 1]).toBe('Ctrl+6=custom2');
  });

  it('shell args array is replaced, not concatenated', () => {
    const text = `
      shell.1.shell_type=Bash
      shell.1.path=/bin/test
      shell.1.args=[--custom,--args]
    `;
    const config = ConfigReader.fromStringToConfig(defaultText, text);
    
    // Shell args should be replaced, not concatenated with defaults
    expect(config.shell![1]?.args).toEqual(['--custom', '--args']);
    expect(config.shell![1]?.args?.length).toBe(2);
  });
});
