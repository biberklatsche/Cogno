import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { PtyHandler } from './pty.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { IPty } from '../pty/pty';

describe('PtyHandler', () => {
  let handler: PtyHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockPty: IPty;
  const terminalId = 'test-terminal-id';
  const shellConfig = { command: 'bash' } as any;

  beforeEach(() => {
    mockBus = new AppBus();
    mockPty = {
      spawn: vi.fn().mockResolvedValue(undefined),
      write: vi.fn(),
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onExit: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      resize: vi.fn().mockResolvedValue(undefined),
      kill: vi.fn(),
    } as unknown as IPty;

    handler = new PtyHandler(terminalId, mockPty, shellConfig, mockBus);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  describe('registration', () => {
    it('should spawn PTY and register data handlers', async () => {
      handler.registerTerminal(mockTerminal);

      // Wait for async spawn
      await vi.waitFor(() => {
        expect(mockPty.spawn).toHaveBeenCalledWith(terminalId, shellConfig, { cols: 80, rows: 24 });
      });

      expect(mockTerminal.onData).toHaveBeenCalled();
      expect(mockPty.onData).toHaveBeenCalled();
      expect(mockPty.onExit).toHaveBeenCalled();
    });
  });

  describe('data flow', () => {
    it('should write terminal data to PTY', async () => {
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockTerminal.onData).toHaveBeenCalled());

      const onDataCallback = vi.mocked(mockTerminal.onData).mock.calls[0][0];
      onDataCallback('user input');

      expect(mockPty.write).toHaveBeenCalledWith('user input');
    });

    it('should write PTY data to terminal and publish PtyInitialized on first data', async () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      const writeSpy = vi.spyOn(mockTerminal, 'write');
      
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onData).toHaveBeenCalled());

      const onPtyDataCallback = vi.mocked(mockPty.onData).mock.calls[0][0];
      
      // First data event
      onPtyDataCallback('pty output 1');
      expect(writeSpy).toHaveBeenCalledWith('pty output 1');
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PtyInitialized',
        payload: terminalId
      }));

      // Second data event
      publishSpy.mockClear();
      onPtyDataCallback('pty output 2');
      expect(writeSpy).toHaveBeenCalledWith('pty output 2');
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('exit handling', () => {
    it('should publish RemovePane when PTY exits', async () => {
      const publishSpy = vi.spyOn(mockBus, 'publish');
      
      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      const onExitCallback = vi.mocked(mockPty.onExit).mock.calls[0][0];
      onExitCallback({ exitCode: 0 });

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'RemovePane',
        payload: terminalId
      }));
    });
  });

  describe('Lifecycle', () => {
    it('should dispose all registered handlers', async () => {
      const terminalDataDispose = vi.fn();
      const ptyDataDispose = vi.fn();
      const ptyExitDispose = vi.fn();

      vi.mocked(mockTerminal.onData).mockReturnValue({ dispose: terminalDataDispose });
      vi.mocked(mockPty.onData).mockReturnValue({ dispose: ptyDataDispose });
      vi.mocked(mockPty.onExit).mockReturnValue({ dispose: ptyExitDispose });

      handler.registerTerminal(mockTerminal);
      await vi.waitFor(() => expect(mockPty.onExit).toHaveBeenCalled());

      handler.dispose();

      expect(terminalDataDispose).toHaveBeenCalled();
      expect(ptyDataDispose).toHaveBeenCalled();
      expect(ptyExitDispose).toHaveBeenCalled();
    });
  });
});
