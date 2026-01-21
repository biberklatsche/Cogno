import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathInjector } from './path.injector';
import { AppBus } from '../../../app-bus/app-bus';
import { IPty } from '../pty/pty';
import { AdapterFactory } from './adapter/adapter.factory';
import { Environment } from '../../../common/environment/environment';

describe('PathInjector', () => {
    let bus: AppBus;
    let mockPty: IPty;
    const terminalId = 'test-terminal-id';

    beforeEach(() => {
        bus = new AppBus();
        mockPty = {
            write: vi.fn(),
            dispose: vi.fn()
        } as any;
        
        vi.spyOn(Environment, 'exeDirPath').mockReturnValue('/test/path');
        vi.spyOn(AdapterFactory, 'create').mockReturnValue({
            pathInjection: (path: string) => `export PATH="${path}:$PATH"`
        } as any);
        
        // Mock setTimeout to execute immediately
        vi.stubGlobal('setTimeout', vi.fn((cb) => cb()));
    });

    it('should inject path when PtyInitialized event is fired', async () => {
        new PathInjector(bus, mockPty, terminalId);
        
        bus.publish({
            path: ['app', 'terminal', terminalId],
            type: 'PtyInitialized',
            payload: { terminalId, shellType: 'Bash' }
        });

        // We need to wait for the async operation in PathInjector
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(Environment.exeDirPath).toHaveBeenCalled();
        expect(AdapterFactory.create).toHaveBeenCalledWith('Bash');
        expect(mockPty.write).toHaveBeenCalledWith('export PATH="/test/path:$PATH"\r');
    });

    it('should dispose and stop listening after injection', async () => {
        const injector = new PathInjector(bus, mockPty, terminalId);
        const disposeSpy = vi.spyOn(injector, 'dispose');
        
        bus.publish({
            path: ['app', 'terminal', terminalId],
            type: 'PtyInitialized',
            payload: { terminalId, shellType: 'Bash' }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(disposeSpy).toHaveBeenCalled();
        
        vi.clearAllMocks();
        
        // Fire again, should not trigger write
        bus.publish({
            path: ['app', 'terminal', terminalId],
            type: 'PtyInitialized',
            payload: { terminalId, shellType: 'Bash' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockPty.write).not.toHaveBeenCalled();
    });
});
