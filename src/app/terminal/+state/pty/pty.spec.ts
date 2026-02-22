import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pty } from './pty';
import { TauriPty } from '../../../_tauri/pty';
import { Logger } from '../../../_tauri/logger';
import { ShellConfig } from '../../../config/+models/config';
import { TauriMockFactory } from '../../../../__test__/mocks/tauri-mock.factory';

vi.mock('../../../_tauri/pty', async (importOriginal) => {
    const { TauriMockFactory } = await import('../../../../__test__/mocks/tauri-mock.factory');
    return {
        TauriPty: TauriMockFactory.createTauriPty()
    };
});

vi.mock('../../../_tauri/logger', () => ({
    Logger: {
        error: vi.fn()
    }
}));

describe('Pty', () => {
    let pty: Pty;
    const terminalId = 'test-terminal';
    const shellConfig: ShellConfig = { shell_type: 'Bash' } as any;
    const dimensions = { cols: 80, rows: 24 };

    beforeEach(() => {
        pty = new Pty();
        vi.clearAllMocks();
    });

    it('should spawn pty', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        expect(TauriPty.spawn).toHaveBeenCalledWith(terminalId, shellConfig, dimensions);
    });

    it('should throw error if resize is called before spawn', () => {
        expect(() => pty.resize(dimensions)).toThrow('Please spawn Pty before resize.');
    });

    it('should resize pty if spawned', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        pty.resize({ cols: 100, rows: 30 });
        expect(TauriPty.resize).toHaveBeenCalledWith(terminalId, 100, 30);
    });

    it('should buffer resize until spawn is finished', async () => {
        let resolveSpawn!: () => void;
        vi.mocked(TauriPty.spawn).mockImplementationOnce(() => new Promise<void>(resolve => {
            resolveSpawn = resolve;
        }));

        const spawnPromise = pty.spawn(terminalId, shellConfig, dimensions);
        pty.resize({ cols: 120, rows: 40 });
        expect(TauriPty.resize).not.toHaveBeenCalled();

        resolveSpawn();
        await spawnPromise;

        expect(TauriPty.resize).toHaveBeenCalledWith(terminalId, 120, 40);
    });

    it('should write to pty if spawned', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        pty.write('ls\n');
        expect(TauriPty.write).toHaveBeenCalledWith(terminalId, 'ls\n');
    });

    it('should listen to data', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        const listener = vi.fn();
        const disposable = pty.onData(listener);
        
        expect(TauriPty.onData).toHaveBeenCalledWith(terminalId, listener);
        
        // Test dispose
        const unlisten = await (vi.mocked(TauriPty.onData).mock.results[0].value);
        disposable.dispose();
        // The mock unlisten function is just a vi.fn() because of the mock setup
    });

    it('should listen to exit', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        const listener = vi.fn();
        const disposable = pty.onExit(listener);
        
        expect(TauriPty.onExit).toHaveBeenCalledWith(terminalId, listener);
        disposable.dispose();
    });

    it('should kill pty on dispose', async () => {
        await pty.spawn(terminalId, shellConfig, dimensions);
        pty.dispose();
        expect(TauriPty.kill).toHaveBeenCalledWith(terminalId);
    });
});
