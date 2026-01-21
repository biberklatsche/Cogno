import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptInjector } from './script.injector';
import { AppBus } from '../../../app-bus/app-bus';
import { IPty } from '../pty/pty';
import { AdapterFactory } from './adapter/adapter.factory';
import { Char } from '../../../common/chars/chars';

vi.mock('./adapter/adapter.factory', () => ({
  AdapterFactory: {
    create: vi.fn()
  }
}));

describe('ScriptInjector', () => {
  let injector: ScriptInjector;
  let mockBus: AppBus;
  let mockPty: IPty;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    mockPty = {
      write: vi.fn(),
    } as unknown as IPty;
    
    vi.clearAllMocks();
  });

  it('should write injection script to PTY when PtyInitialized is received', async () => {
    const mockAdapter = {
      injectionScript: vi.fn().mockResolvedValue('test script')
    };
    vi.mocked(AdapterFactory.create).mockReturnValue(mockAdapter as any);

    injector = new ScriptInjector(mockBus, mockPty, terminalId);

    mockBus.publish({
      type: 'PtyInitialized',
      path: ['app', 'terminal', terminalId],
      payload: { terminalId, shellType: 'Bash' as any },
      phase: 'target'
    });

    await vi.waitFor(() => {
      expect(AdapterFactory.create).toHaveBeenCalledWith('Bash');
      expect(mockPty.write).toHaveBeenCalledWith('test script' + Char.Enter);
    });
  });

  it('should handle empty script', async () => {
    const mockAdapter = {
      injectionScript: vi.fn().mockResolvedValue('')
    };
    vi.mocked(AdapterFactory.create).mockReturnValue(mockAdapter as any);

    injector = new ScriptInjector(mockBus, mockPty, terminalId);

    mockBus.publish({
      type: 'PtyInitialized',
      path: ['app', 'terminal', terminalId],
      payload: { terminalId, shellType: 'Bash' as any },
      phase: 'target'
    });

    // Should not call pty.write
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockPty.write).not.toHaveBeenCalled();
  });

  it('should unsubscribe on dispose', async () => {
    const mockAdapter = {
      injectionScript: vi.fn().mockResolvedValue('test script')
    };
    vi.mocked(AdapterFactory.create).mockReturnValue(mockAdapter as any);

    injector = new ScriptInjector(mockBus, mockPty, terminalId);
    injector.dispose();

    mockBus.publish({
      type: 'PtyInitialized',
      path: ['app', 'terminal', terminalId],
      payload: { terminalId, shellType: 'Bash' as any },
      phase: 'target'
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockPty.write).not.toHaveBeenCalled();
  });
});
