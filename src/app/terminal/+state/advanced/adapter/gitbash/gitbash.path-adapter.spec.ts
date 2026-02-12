import { describe, it, expect } from 'vitest';
import { GitBashPathAdapter } from './gitbash.path-adapter';

describe('GitBashPathAdapter', () => {
    const adapter = new GitBashPathAdapter({backendOs: 'windows'});

    it('should normalize Unix paths to MSYS virtual paths if not a drive', () => {
        expect(adapter.normalize('/usr/bin/ls')).toBe('//msys/usr/bin/ls');
    });

    it('should normalize drive letters correctly', () => {
        expect(adapter.normalize('/c/temp')).toBe('/c/temp');
    });

    it('should render MSYS paths back to absolute paths in shell view', () => {
        expect(adapter.render('//msys/usr/bin/ls', { purpose: 'display' })).toBe('/usr/bin/ls');
    });

    it('should render UNC paths in Git Bash style', () => {
        expect(adapter.render('//unc/server/share/file', { purpose: 'display' })).toBe('//server/share/file');
    });

    it('should render Windows path in Git Bash', () => {
        expect(adapter.render('/c/server/share/file', { purpose: 'backend_fs'})).toBe('C:\\server\\share\\file');
    });
});
