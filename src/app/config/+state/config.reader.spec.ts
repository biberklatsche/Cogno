import { describe, it, expect } from 'vitest';
import { ConfigReader } from './config.reader';
import { DEFAULT_CONFIG } from '../+models/config';

describe('ConfigReader', () => {
  it('parseUserString parses booleans, numbers, arrays', () => {
    const text = `
      # comment
      ; another comment
      autocomplete.mode=always
      autocomplete.ignore=[cd ..,"cd ."]
      general.enable_telemetry=true
      general.scrollback_lines=12345
      theme.default.enable_webgl=true
      theme.default.color.prompt.1.foreground="red"
      theme.default.color.prompt.1.background=black
      shell.1.name=zsh
      shell.1.shell_type=ZSH
      shell.1.path=/bin/zsh
      keybind=Ctrl+5=run5
    `;

    const parsed = ConfigReader.fromStringToConfig(text);

    // Nested structure exists
    expect(parsed.general).toBeDefined();
    expect(parsed.general.enable_telemetry).toBe(true);
    expect(parsed.general.scrollback_lines).toBe(12345);

    expect(parsed.autocomplete.mode).toBe('always');
    expect(parsed.autocomplete.ignore[0]).toBe('cd ..');
    expect(parsed.autocomplete.ignore[1]).toBe('cd .');

    expect(parsed.theme.default.enable_webgl).toBe(true);

    // Arrays/objects are parsed via JSON
    expect(parsed.theme.default.color.prompt["1"].foreground).toEqual('red');
    expect(parsed.theme.default.color.prompt["1"].background).toEqual('black');

    expect(parsed.shell["1"]!.name).toEqual('zsh');
    expect(parsed.shell["1"]!.shell_type).toEqual('ZSH');
    expect(parsed.shell["1"]!.path).toEqual('/bin/zsh');
    expect(parsed.shell["1"]!.use_conpty).toBeUndefined();

    // Keybind array now concatenates: defaults first, then user values
    const defaultKeybindCount = DEFAULT_CONFIG.keybind.length;
    expect(parsed.keybind.length).toBe(defaultKeybindCount + 1);
    expect(parsed.keybind[defaultKeybindCount]).toBe('Ctrl+5=run5');
  });

  it('toSettings fills defaults and keeps overrides', () => {
    const text = `
      general.enable_telemetry=false
      theme.default.enable_webgl=true
    `;

    const settings = ConfigReader.fromStringToConfig(text);

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
    expect(() => ConfigReader.fromStringToConfig(text)).toThrowError();
  });

  it('fromStringToSettings integrates parse + validate + defaults', () => {
    const proper = `general.enable_telemetry=false\ngeneral.scrollback_lines=9999\n`;
    const settings = ConfigReader.fromStringToConfig(proper);
    expect(settings.general.enable_telemetry).toBe(false);
    expect(settings.general.scrollback_lines).toBe(9999);
    // A default field still exists
    expect(settings.theme.default.enable_webgl).toBe(false);
  });

  it('keybind array is concatenated with defaults (defaults first, then user values)', () => {
    const text = `
      keybind=Ctrl+5=custom1
      keybind=Ctrl+6=custom2
    `;
    const config = ConfigReader.fromStringToConfig(text);
    
    // User keybinds should be appended to defaults
    const defaultKeybindCount = DEFAULT_CONFIG.keybind.length;
    expect(config.keybind.length).toBe(defaultKeybindCount + 2);
    
    // First entries should be defaults
    expect(config.keybind[0]).toBe(DEFAULT_CONFIG.keybind[0]);
    
    // Last entries should be user-provided
    expect(config.keybind[defaultKeybindCount]).toBe('Ctrl+5=custom1');
    expect(config.keybind[defaultKeybindCount + 1]).toBe('Ctrl+6=custom2');
  });

  it('other arrays (autocomplete.ignore) are replaced, not concatenated', () => {
    const text = `
      autocomplete.ignore=[custom1,custom2]
    `;
    const config = ConfigReader.fromStringToConfig(text);
    
    // Should replace defaults completely, not concatenate
    expect(config.autocomplete.ignore).toEqual(['custom1', 'custom2']);
    expect(config.autocomplete.ignore.length).toBe(2);
    
    // Should NOT contain default values
    const defaultIgnore = DEFAULT_CONFIG.autocomplete.ignore;
    expect(config.autocomplete.ignore).not.toContain(defaultIgnore[0]);
  });

  it('shell args array is replaced, not concatenated', () => {
    const text = `
      shell.1.name=TestShell
      shell.1.shell_type=Bash
      shell.1.path=/bin/test
      shell.1.args=[--custom,--args]
    `;
    const config = ConfigReader.fromStringToConfig(text);
    
    // Shell args should be replaced, not concatenated with defaults
    expect(config.shell[1]?.args).toEqual(['--custom', '--args']);
    expect(config.shell[1]?.args?.length).toBe(2);
  });
});
