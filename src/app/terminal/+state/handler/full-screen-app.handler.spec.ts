import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { FullScreenAppHandler } from './full-screen-app.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';

describe('FullScreenAppHandler', () => {
  let handler: FullScreenAppHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    handler = new FullScreenAppHandler(terminalId, mockBus);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('registration', () => {
    it('should register CSI handlers', () => {
      handler.register(mockTerminal);
      expect(mockTerminal.parser.registerCsiHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('CSI handler logic', () => {
    let publishSpy: any;

    beforeEach(() => {
      publishSpy = vi.spyOn(mockBus, 'publish');
      handler.register(mockTerminal);
    });

    it('should publish FullScreenAppEntered when Restore Window CSI sequence is received', () => {
      const csiHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).final === 't'
      )![1];

      csiHandler([22, 0, 0]);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'FullScreenAppEntered',
        payload: terminalId
      }));
    });

    it('should publish FullScreenAppLeaved when Save Window CSI sequence is received', () => {
      const csiHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).final === 't'
      )![1];

      csiHandler([23, 0, 0]);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'FullScreenAppLeaved',
        payload: terminalId
      }));
    });

    it('should publish FullScreenAppEntered when alternate screen buffer is enabled', () => {
      const csiHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).prefix === '?' && (call[0] as any).final === 'h'
      )![1];

      csiHandler([1049]);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'FullScreenAppEntered',
        payload: terminalId
      }));
    });

    it('should publish FullScreenAppLeaved when alternate screen buffer is disabled', () => {
      const csiHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).prefix === '?' && (call[0] as any).final === 'l'
      )![1];

      csiHandler([1049]);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'FullScreenAppLeaved',
        payload: terminalId
      }));
    });

    it('should handle helix mouse tracking sequences', () => {
      const hHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).prefix === '?' && (call[0] as any).final === 'h'
      )![1];
      const lHandler = vi.mocked(mockTerminal.parser.registerCsiHandler).mock.calls.find(call => 
        (call[0] as any).prefix === '?' && (call[0] as any).final === 'l'
      )![1];

      lHandler([1003, 1006]);
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'FullScreenAppEntered' }));

      publishSpy.mockClear();
      hHandler([1003, 1006]);
      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'FullScreenAppLeaved' }));
    });
  });

  describe('Lifecycle', () => {
    it('should dispose all registered handlers', () => {
      const disposeSpy = vi.fn();
      vi.mocked(mockTerminal.parser.registerCsiHandler).mockReturnValue({ dispose: disposeSpy });
      
      handler.register(mockTerminal);
      handler.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(3);
    });
  });
});
