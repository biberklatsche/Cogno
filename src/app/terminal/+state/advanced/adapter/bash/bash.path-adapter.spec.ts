import { describe, it, expect } from 'vitest';
import { BashPathAdapter } from './bash.path-adapter';

describe('BashPathAdapter', () => {
    const adapter = new BashPathAdapter({backendOs: "linux"});

    it('should normalize windows drives to cogno paths', () => {
        expect(adapter.normalize('C:\\temp\\file.txt')).toBe('/c/temp/file.txt');
    });

    it('should normalize UNC paths', () => {
        expect(adapter.normalize('\\\\server\\share\\path')).toBe('//unc/server/share/path');
    });

    it('should normalize WSL mount paths', () => {
        expect(adapter.normalize('/mnt/c/Users')).toBe('/c/Users');
    });

    it('should render posix paths normally', () => {
        expect(adapter.render('/c/temp/file.txt', { purpose: 'display' })).toBe('/c/temp/file.txt');
    });

    it('should render for backend_fs on linux', () => {
        expect(adapter.render('/usr/bin/ls', { purpose: 'backend_fs'})).toBe('/usr/bin/ls');
    });

    it('should render for backend_fs on windows', () => {
        const adapter = new BashPathAdapter({backendOs: "windows"});
        expect(adapter.render('/c/temp/file.txt', { purpose: 'backend_fs'})).toBe('C:\\temp\\file.txt');
    });

    it('should map unix paths to WSL namespace when context is WSL', () => {
        const adapter = new BashPathAdapter({backendOs: "windows", wslDistroName: "Ubuntu"});
        expect(adapter.normalize('/home/lars/project')).toBe('//wsl/Ubuntu/home/lars/project');
        expect(adapter.render('//wsl/Ubuntu/home/lars/project', { purpose: 'display'})).toBe('/home/lars/project');
        expect(adapter.render('//wsl/Ubuntu/home/lars/project', { purpose: 'backend_fs'}))
            .toBe('\\\\wsl.localhost\\Ubuntu\\home\\lars\\project');
    });

    it('should normalize wsl UNC host paths', () => {
        const adapter = new BashPathAdapter({backendOs: "windows", wslDistroName: "Ubuntu"});
        expect(adapter.normalize('\\\\wsl.localhost\\Ubuntu\\home\\lars')).toBe('//wsl/Ubuntu/home/lars');
    });

    it('should quote if needed', () => {
        expect(adapter.render('/path/with space', { purpose: 'insert_arg' })).toBe("'/path/with space'");
    });
    
    it('should quote with escaped single quotes', () => {
        expect(adapter.render("/path/with'quote", { purpose: 'insert_arg', quoteMode: 'always' })).toBe("'/path/with'\\''quote'");
    });

    it('should not quote if not needed', () => {
        expect(adapter.render('/path/to/file', { purpose: 'insert_arg' })).toBe("/path/to/file");
    });
});
