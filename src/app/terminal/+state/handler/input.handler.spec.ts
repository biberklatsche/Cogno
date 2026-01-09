import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { InputHandler } from './input.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { Clipboard } from '../../../_tauri/clipboard';

vi.mock('../../../_tauri/clipboard', () => ({
  Clipboard: {
    readText: vi.fn(),
  },
}));

describe('InputHandler', () => {
  let handler: InputHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    handler = new InputHandler(mockBus, terminalId);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('registration', () => {
    it('should register for bus events', () => {
      const subscribeSpy = vi.spyOn(mockBus, 'on$');
      handler.register(mockTerminal);
      expect(subscribeSpy).toHaveBeenCalled();
    });
  });

  describe('bus events', () => {
    beforeEach(() => {
      handler.register(mockTerminal);
    });

    it('should clear terminal when ClearBuffer event for this id is received', () => {
      const clearSpy = vi.spyOn(mockTerminal, 'clear');
      mockBus.publish({ type: 'ClearBuffer', payload: terminalId, path: ['app', 'terminal'] });
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should not clear terminal when ClearBuffer event for other id is received', () => {
      const clearSpy = vi.spyOn(mockTerminal, 'clear');
      mockBus.publish({ type: 'ClearBuffer', payload: 'other-id', path: ['app', 'terminal'] });
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('should input clipboard text when Paste event for this id is received', async () => {
      const inputSpy = vi.spyOn(mockTerminal, 'input');
      vi.mocked(Clipboard.readText).mockResolvedValue('pasted content');

      mockBus.publish({ type: 'Paste', payload: terminalId, path: ['app', 'terminal'] });

      // Wait for async clipboard read
      await vi.waitFor(() => expect(inputSpy).toHaveBeenCalledWith('pasted content'));
    });

    it('should not input clipboard text when Paste event for other id is received', async () => {
      const inputSpy = vi.spyOn(mockTerminal, 'input');
      vi.mocked(Clipboard.readText).mockResolvedValue('pasted content');

      mockBus.publish({ type: 'Paste', payload: 'other-id', path: ['app', 'terminal'] });

      // Small delay to ensure it didn't happen
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(inputSpy).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on dispose', () => {
      const clearSpy = vi.spyOn(mockTerminal, 'clear');
      handler.register(mockTerminal);
      handler.dispose();

      mockBus.publish({ type: 'ClearBuffer', payload: terminalId, path: ['app', 'terminal'] });
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});
