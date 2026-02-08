import { describe, it, expect } from 'vitest';
import { PathFactory } from './path.factory';
import { BashPathAdapter } from './bash/bash.path-adapter';
import { ZshPathAdapter } from './zsh/zsh.path-adapter';
import { FishPathAdapter } from './fish/fish.path-adapter';
import { PowerShellPathAdapter } from './powershell/powershell.path-adapter';
import { GitBashPathAdapter } from './gitbash/gitbash.path-adapter';

describe('PathFactory', () => {
    it('should create BashPathAdapter', () => {
        expect(PathFactory.createAdapter('Bash')).toBeInstanceOf(BashPathAdapter);
    });

    it('should create ZshPathAdapter', () => {
        expect(PathFactory.createAdapter('ZSH')).toBeInstanceOf(ZshPathAdapter);
    });

    it('should create FishPathAdapter', () => {
        expect(PathFactory.createAdapter('Fish')).toBeInstanceOf(FishPathAdapter);
    });

    it('should create PowerShellPathAdapter', () => {
        expect(PathFactory.createAdapter('PowerShell')).toBeInstanceOf(PowerShellPathAdapter);
    });

    it('should create GitBashPathAdapter', () => {
        expect(PathFactory.createAdapter('GitBash')).toBeInstanceOf(GitBashPathAdapter);
    });

    it('should throw error for unsupported shell type', () => {
        expect(() => PathFactory.createAdapter('Unsupported' as any)).toThrow('Unsupported shell type: Unsupported');
    });
});
