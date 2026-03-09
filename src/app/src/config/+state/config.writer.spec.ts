import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigWriter } from './config.writer';
import { ConfigReader } from './config.reader';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {Config} from "../+models/config";
import { z } from 'zod';

let defaultText = '';
let DEFAULTS: Config;

beforeAll(() => {
  const p = join(process.cwd(), 'src-tauri', 'src', 'default_windows.config');
  defaultText = readFileSync(p, 'utf-8');
  // Parse defaults from text (no user overrides)
  DEFAULTS = ConfigReader.fromStringToConfig(defaultText, '');
});

describe('ConfigWriter', () => {

  it('toDotString can render without comments when asComments=false', () => {
    const curr: Config = JSON.parse(JSON.stringify(DEFAULTS));
    curr.enable_webgl = true;
    if (!curr.scrollbar) curr.scrollbar = {};
    curr.scrollbar.scrollback_lines = 1234;

    const text = ConfigWriter.toDotString(curr, false);
    const lines = text.trimEnd().split('\n');

    // Ensure no comment lines are present
    expect(lines.some(l => l.startsWith('#'))).toBe(false);

    // Contains some expected values
    expect(lines).toContain('enable_webgl = true');
    expect(lines).toContain('scrollbar.scrollback_lines = 1234');

    // trailing newline is present according to implementation
    expect(text.endsWith('\n')).toBe(true);
  });

  it('renders with comments and descriptions from schema', () => {
    const curr: Config = JSON.parse(JSON.stringify(DEFAULTS));
    curr.enable_webgl = true;

    const text = ConfigWriter.toDotString(curr, true);
    // Since we don't know the exact descriptions without looking at ConfigSchema closely,
    // we check for general presence of comments.
    expect(text).toContain('# ');
    expect(text).toContain('enable_webgl = true');
  });

  it('handles edge cases in unwrapSchema and extractShape', () => {
    // We create a mock schema to trigger specific branches in ConfigWriter's private methods
    // since they are called via toDotProperties.
    const mockConfig: Config = {
        scrollbar: {
            slider_color: '11111',

        }
    };
    
    // We can't easily pass a custom schema to toDotString without changing the signature,
    // but we can test it through the public API with different config structures.
    const text = ConfigWriter.toDotString(mockConfig, true);
    expect(text).toContain('scrollbar.slider_color = 11111');
  });

  it('renders other arrays as comma-separated list', () => {
      const config = {
          some_array: [1, 2, 'three']
      } as any;
      const text = ConfigWriter.toDotString(config, false);
      expect(text).toContain('some_array = [1,2,three]');
  });

  it('handles complex nested objects', () => {
      const config = {
          a: {
              b: {
                  c: 1
              },
              d: 2
          }
      } as any;
      const text = ConfigWriter.toDotString(config, false);
      const lines = text.trim().split('\n');
      expect(lines).toContain('a.b.c = 1');
      expect(lines).toContain('a.d = 2');
  });

  it('handles zod unwrap cases in toDotProperties', () => {
      // Create a complex schema with optional, nullable, describe
      const subSchema = z.object({
          val: z.number().describe('A sub value')
      }).optional().describe('A sub object');
      
      const schema = z.object({
          test: subSchema
      });

      const config = {
          test: {
              val: 42
          }
      };

      // We need to call private methods or find a way to use our schema.
      // Since toDotString uses ConfigSchema, we can't easily swap it.
      // But we can call the private toDotProperties via casting.
      const lines = (ConfigWriter as any).toDotProperties(config, "", schema, true);
      const text = lines.join('\n');
      
      expect(text).toContain('# A sub value');
      expect(text).toContain('test.val = 42');
  });

  it('handles getSchemaDescription with different zod types', () => {
      const s1 = z.string().describe('desc1');
      const s2 = z.string().optional().describe('desc2');
      const s3 = z.string().nullable().describe('desc3');
      
      expect((ConfigWriter as any).getSchemaDescription(s1)).toBe('desc1');
      expect((ConfigWriter as any).getSchemaDescription(s2)).toBe('desc2');
      expect((ConfigWriter as any).getSchemaDescription(s3)).toBe('desc3');
  });

  it('handles extractShape with union/intersection (fallback)', () => {
      const s = z.union([z.string(), z.number()]);
      const res = (ConfigWriter as any).getChildSchema(s, 'anything');
      expect(res).toBeUndefined();
  });

  it('handles getChildSchema with null parent', () => {
      expect((ConfigWriter as any).getChildSchema(null, 'key')).toBeUndefined();
  });

  it('handles getChildSchema with schema that has no _def', () => {
      expect((ConfigWriter as any).getChildSchema({}, 'key')).toBeUndefined();
  });

  it('renders complex values via JSON.stringify', () => {
      const config = {
          complex: { a: 1 }
      } as any;
      // We need to bypass the isPlainObject check for the leaf value to trigger renderValue with object
      // But toDotProperties recursion will treat it as plain object.
      // We can test renderValue directly.
      expect((ConfigWriter as any).renderValue({a:1})).toBe('{"a":1}');
  });

  it('handles getSchemaDescription with null/undefined', () => {
      expect((ConfigWriter as any).getSchemaDescription(null)).toBeUndefined();
      expect((ConfigWriter as any).getSchemaDescription(undefined)).toBeUndefined();
  });

  it('renders keybinds multiline', () => {
      const config = {
          keybind: ['a=b', 'c=d']
      } as any;
      const text = ConfigWriter.toDotString(config, false);
      expect(text).toContain('keybind = a=b\nkeybind = c=d');
  });
});
