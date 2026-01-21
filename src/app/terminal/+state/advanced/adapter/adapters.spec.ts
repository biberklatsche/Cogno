import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BashAdapter } from './bash.adapter';
import { ZshAdapter } from './zsh.adapter';
import { PowerShellAdapter } from './powershell.adapter';
import { AdapterFactory } from './adapter.factory';
import { Script } from '../../../../_tauri/script';

vi.mock('../../../../_tauri/script', () => ({
    Script: {
        read: vi.fn()
    }
}));

describe('Shell Adapters', () => {
    
    describe('AdapterFactory', () => {
        it('should create BashAdapter for Bash and GitBash', () => {
            expect(AdapterFactory.create('Bash')).toBeInstanceOf(BashAdapter);
            expect(AdapterFactory.create('GitBash')).toBeInstanceOf(BashAdapter);
        });

        it('should create ZshAdapter for ZSH', () => {
            expect(AdapterFactory.create('ZSH')).toBeInstanceOf(ZshAdapter);
        });

        it('should create PowerShellAdapter for PowerShell', () => {
            expect(AdapterFactory.create('PowerShell')).toBeInstanceOf(PowerShellAdapter);
        });

        it('should throw error for unknown shell type', () => {
            expect(() => AdapterFactory.create('Unknown' as any)).toThrow('Unknown shell type');
        });
    });

    describe('BashAdapter', () => {
        let adapter: BashAdapter;

        beforeEach(() => {
            adapter = new BashAdapter();
        });

        it('should generate injection script and drop shebang', async () => {
            vi.mocked(Script.read).mockResolvedValue('#!/bin/bash\necho hello');
            const result = await adapter.injectionScript();
            
            // "echo hello" in base64 is "ZWNobyBoZWxsbw=="
            expect(result).toContain('ZWNobyBoZWxsbw==');
            expect(result).toContain('eval "$(echo');
        });

        it('should generate path injection command', () => {
            const result = adapter.pathInjection('/test/path');
            expect(result).toBe(' export PATH="/test/path:$PATH"; clear;');
        });
    });

    describe('ZshAdapter', () => {
        let adapter: ZshAdapter;

        beforeEach(() => {
            adapter = new ZshAdapter();
        });

        it('should generate injection script', async () => {
            vi.mocked(Script.read).mockResolvedValue('echo zsh');
            const result = await adapter.injectionScript();
            
            // "echo zsh" in base64 is "ZWNobyB6c2g="
            expect(result).toContain('ZWNobyB6c2g=');
        });

        it('should generate path injection command', () => {
            const result = adapter.pathInjection('/test/path');
            expect(result).toBe(' export PATH="/test/path:$PATH"; clear;');
        });
    });

    describe('PowerShellAdapter', () => {
        let adapter: PowerShellAdapter;

        beforeEach(() => {
            adapter = new PowerShellAdapter();
        });

        it('should generate injection script with UTF-16LE Base64', async () => {
            vi.mocked(Script.read).mockResolvedValue('ls');
            const result = await adapter.injectionScript();
            
            // "ls" in UTF-16LE is [0x6c, 0x00, 0x73, 0x00]
            // btoa(String.fromCharCode(0x6c, 0x00, 0x73, 0x00)) -> "bABzAA=="
            expect(result).toContain('bABzAA==');
            expect(result).toContain('iex ([Text.Encoding]::Unicode.GetString');
        });

        it('should generate path injection command', () => {
            const result = adapter.pathInjection('/test/path');
            expect(result).toBe('$env:PATH = "/test/path;" + $env:PATH; Clear-Host');
        });
    });
});
