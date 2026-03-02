import {describe, it, expect, beforeAll} from 'vitest';
import {ConfigReader} from './config.reader';
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
      scrollbar.scrollback_lines=12345
      cursor.blink=false
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/bash
      shell.profiles.default.args=[--login,"-i"]
      keybind=Ctrl+5=run5
    `;

        const parsed = ConfigReader.fromStringToConfig(defaultText, text);

        // Basic values
        expect(parsed.enable_webgl).toBe(true);
        expect(parsed.scrollbar!.scrollback_lines).toBe(12345);
        expect(parsed.cursor!.blink).toBe(false);

        // Array parsing (non-keybind arrays are replaced)
        expect(parsed.shell!.profiles['default']?.args).toEqual(['--login', '-i']);

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
        expect(settings.scrollbar!.scrollback_lines).toBe(100000);
        expect(settings.font!.size).toBe(14);
    });

    it('collects errors on invalid values (e.g., negative scrollback_lines) and ignores them', () => {
        const text = `
      scrollbar.scrollback_lines=-1
    `;
        const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text);
        expect(result.diagnostics.length).toBeGreaterThan(0);
        expect(result.diagnostics.some(d => d.level === 'error')).toBe(true);
        expect(result.config.scrollbar!.scrollback_lines).toBe(100000);
    });

    it('ignores unknown settings and reports warnings', () => {
        const text = `
      unknown_key=123
      font.size=13
    `;
        const result = ConfigReader.fromStringToConfigWithDiagnostics(defaultText, text);
        expect(result.config.font!.size).toBe(13);
        expect(result.diagnostics.some(d => d.level === 'warning')).toBe(true);
    });

    it('single-arg overload still works (no defaults)', () => {
        const proper = `enable_webgl=false\nscrollbar.scrollback_lines=9999\n`;
        const settings = ConfigReader.fromStringToConfig(proper);
        expect(settings.enable_webgl).toBe(false);
        expect(settings.scrollbar!.scrollback_lines).toBe(9999);
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
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/test
      shell.profiles.default.args=[--custom,--args]
    `;
        const config = ConfigReader.fromStringToConfig(defaultText, text);

        // Shell args should be replaced, not concatenated with defaults
        expect(config.shell!.profiles['default']?.args).toEqual(['--custom', '--args']);
        expect(config.shell!.profiles['default']?.args?.length).toBe(2);
    });

    it('empty array [] is parsed correctly, not as [undefined]', () => {
        const text = `
      shell.default=default
      shell.profiles.default.shell_type=Bash
      shell.profiles.default.path=/bin/test
      shell.profiles.default.args=[]
    `;
        const config = ConfigReader.fromStringToConfig(defaultText, text);

        // Empty array should be [], not [undefined]
        expect(config.shell!.profiles['default']?.args).toEqual([]);
        expect(config.shell!.profiles['default']?.args?.length).toBe(0);
    });

    it('adds platform-specific font fallbacks to font.family', () => {
        const text = `
      font.family=monospace
    `;
        const config = ConfigReader.fromStringToConfig(defaultText, text);

        // Font should have fallbacks added
        expect(config.font!.family).toContain('monospace');
        expect(config.font!.family).toContain('ui-monospace');
        expect(config.font!.family).toMatch(/monospace.*ui-monospace|ui-monospace.*monospace/);
    });

    it('handles font names with spaces in fallback list', () => {
        const text = `
      font.family=Fira Code
    `;
        const config = ConfigReader.fromStringToConfig(defaultText, text);

        // Font name with spaces should be preserved without quotes
        expect(config.font!.family).toMatch(/^Fira Code,/);
        expect(config.font!.family).toContain('ui-monospace');
    });
});
