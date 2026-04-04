import { describe, it, expect } from 'vitest';
import OscParser from './cogno-osc.parser';

describe('OscParser', () => {
    it('should parse a simple sequence', () => {
        const input = "COGNO:PROMPT;returnCode=0;user=larswolfram;machine=Air-von-Lars;directory=/Users/larswolfram;id=7;command=ls;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            returnCode: '0',
            user: 'larswolfram',
            machine: 'Air-von-Lars',
            directory: '/Users/larswolfram',
            id: '7',
            command: 'ls'
        });
    });

    it('should parse a C:\\ sequence correctly', () => {
        const input = "COGNO:PROMPT;returnCode=0;user=micro;machine=SUPERPOWER;directory=C:\\;id=3;command=cd ..";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            returnCode: '0',
            user: 'micro',
            machine: 'SUPERPOWER',
            directory: "C:\\",
            id: '3',
            command: 'cd ..'
        });
    })

    it('should parse sequences without prefix', () => {
        const input = "returnCode=1;user=test;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            returnCode: '1',
            user: 'test'
        });
    });

    it('should handle empty inputs', () => {
        expect(OscParser.parse('')).toBeUndefined();
        // @ts-ignore
        expect(OscParser.parse(null)).toBeUndefined();
    });

    it('should correctly handle escaped semicolons', () => {
        const input = "c=echo \\; hello;r=0;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            c: 'echo ; hello',
            r: '0'
        });
    });

    it('should correctly decode escaped newlines and other characters', () => {
        const input = "m=line1\\nline2;p=a\\|b;s=back\\\\slash;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            m: 'line1\nline2',
            p: 'a|b',
            s: 'back\\slash'
        });
    });

    it('should trim leading/trailing whitespace in keys', () => {
        const input = " r = 0 ; u = user ;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: ' 0 ',
            u: ' user '
        });
        // Note: According to the code, only the key is trimmed: const key = part.slice(0, eq).trim();
        // The value is decoded via decodeValue, but not explicitly trimmed.
    });

    it('should ignore parts without an equals sign', () => {
        const input = "r=0;invalid_part;u=user;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0',
            u: 'user'
        });
    });

    it('should ignore parts with an empty key', () => {
        const input = "r=0;=value;u=user;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0',
            u: 'user'
        });
    });

    it('should handle multiple semicolons at the end', () => {
        const input = "r=0;;;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0'
        });
    });

    it('should correctly handle an escaped equals sign in the value', () => {
        // indexOfUnescaped finds the first unescaped '='
        const input = "cmd=ls -l \\=always;r=0;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            cmd: 'ls -l =always',
            r: '0'
        });
    });
});


