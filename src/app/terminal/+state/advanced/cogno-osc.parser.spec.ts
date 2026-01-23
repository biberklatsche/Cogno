import { describe, it, expect } from 'vitest';
import OscParser from './cogno-osc.parser';

describe('OscParser', () => {
    it('sollte eine einfache Sequenz korrekt parsen', () => {
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

    it('sollte Sequenzen ohne Präfix parsen', () => {
        const input = "returnCode=1;user=test;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            returnCode: '1',
            user: 'test'
        });
    });

    it('sollte mit leeren Eingaben umgehen', () => {
        expect(OscParser.parse('')).toBeUndefined();
        // @ts-ignore
        expect(OscParser.parse(null)).toBeUndefined();
    });

    it('sollte maskierte Semikolons korrekt behandeln', () => {
        const input = "c=echo \\; hello;r=0;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            c: 'echo ; hello',
            r: '0'
        });
    });

    it('sollte maskierte Newlines und andere Zeichen korrekt dekodieren', () => {
        const input = "m=line1\\nline2;p=a\\|b;s=back\\\\slash;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            m: 'line1\nline2',
            p: 'a|b',
            s: 'back\\slash'
        });
    });

    it('sollte führende/nachfolgende Leerzeichen in Schlüsseln trimmen', () => {
        const input = " r = 0 ; u = user ;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: ' 0 ',
            u: ' user '
        });
        // Hinweis: Laut Code wird nur der Key getrimmt: const key = part.slice(0, eq).trim();
        // Der Wert wird per decodeValue dekodiert, aber nicht explizit getrimmt.
    });

    it('sollte Parts ohne Gleichheitszeichen ignorieren', () => {
        const input = "r=0;invalid_part;u=user;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0',
            u: 'user'
        });
    });

    it('sollte Parts mit leerem Schlüssel ignorieren', () => {
        const input = "r=0;=value;u=user;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0',
            u: 'user'
        });
    });

    it('sollte mit mehrfachen Semikolons am Ende umgehen', () => {
        const input = "r=0;;;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            r: '0'
        });
    });

    it('sollte ein maskiertes Gleichheitszeichen im Wert korrekt behandeln', () => {
        // indexOfUnescaped findet das erste unmaskierte '='
        const input = "cmd=ls -l \\=always;r=0;";
        const result = OscParser.parse(input);
        expect(result).toEqual({
            cmd: 'ls -l =always',
            r: '0'
        });
    });
});
