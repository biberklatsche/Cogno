import { describe, it, expect } from 'vitest';
import { PowerShellPathAdapter } from './powershell.path-adapter';

describe('PowerShellPathAdapter', () => {
    const adapter = new PowerShellPathAdapter({backendOs: 'windows'});

    it('should render as windows path in shell view', () => {
        expect(adapter.render('/c/temp/file.txt', { purpose: 'display' })).toBe('C:\\temp\\file.txt');
    });

    it('should render UNC paths in shell view', () => {
        expect(adapter.render('//unc/server/share/file', { purpose: 'display' })).toBe('\\\\server\\share\\file');
    });

    it('should quote using powershell rules', () => {
        expect(adapter.render('/c/path with space', { purpose: 'insert_arg' })).toBe("'C:\\path with space'");
    });

    it('should escape single quotes by doubling them', () => {
        expect(adapter.render("/c/path'with'quote", { purpose: 'insert_arg', quoteMode: 'always' })).toBe("'C:\\path''with''quote'");
    });
});
