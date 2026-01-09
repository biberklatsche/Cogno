import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { SelectionHandler } from './selection.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { Clipboard } from '../../../_tauri/clipboard';
import { ConfigServiceMock } from '../../../../__test__/mocks/config-service.mock';
import { clear, getAppBus, getConfigService, getSelectionHandler } from '../../../../__test__/test-factory';

vi.mock('../../../_tauri/clipboard', () => ({
  Clipboard: {
    writeText: vi.fn(),
  },
}));

describe('SelectionHandler', () => {
  let handler: SelectionHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockConfig: ConfigServiceMock;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    clear();
    mockBus = getAppBus();
    mockConfig = getConfigService();
    mockConfig.setConfig({
      selection: { clear_on_copy: false }
    });
    handler = getSelectionHandler(terminalId);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('selection methods', () => {
    beforeEach(() => {
      handler.register(mockTerminal);
    });

    it('should proxy hasSelection', () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      expect(handler.hasSelection()).toBe(true);
      
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(false);
      expect(handler.hasSelection()).toBe(false);
    });

    it('should proxy getSelection', () => {
      vi.mocked(mockTerminal.getSelection).mockReturnValue('selected text');
      expect(handler.getSelection()).toBe('selected text');
    });

    it('should proxy clearSelection', () => {
      handler.clearSelection();
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });
  });

  describe('bus events', () => {
    beforeEach(() => {
      handler.register(mockTerminal);
    });

    it('should copy selection to clipboard when Copy event is received', async () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue('text to copy');
      
      mockBus.publish({ type: 'Copy', payload: terminalId, path: ['app', 'terminal'] });

      await vi.waitFor(() => {
        expect(Clipboard.writeText).toHaveBeenCalledWith('text to copy');
      });
    });

    it('should clear selection after copy if configured', async () => {
      mockConfig.setConfig({
        selection: { clear_on_copy: true }
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue('text to copy');

      mockBus.publish({ type: 'Copy', payload: terminalId, path: ['app', 'terminal'] });

      await vi.waitFor(() => {
        expect(mockTerminal.clearSelection).toHaveBeenCalled();
      });
    });

    it('should not clear selection after copy if not configured', async () => {
      mockConfig.setConfig({
        selection: { clear_on_copy: false }
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue('text to copy');

      mockBus.publish({ type: 'Copy', payload: terminalId, path: ['app', 'terminal'] });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockTerminal.clearSelection).not.toHaveBeenCalled();
    });

    it('should do nothing if other terminal id in Copy event', async () => {
      mockBus.publish({ type: 'Copy', payload: 'other-id', path: ['app', 'terminal'] });
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });

    it('should do nothing if no selection exists', async () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(false);
      mockBus.publish({ type: 'Copy', payload: terminalId, path: ['app', 'terminal'] });
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on dispose', () => {
      handler.register(mockTerminal);
      handler.dispose();
      
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      mockBus.publish({ type: 'Copy', payload: terminalId, path: ['app', 'terminal'] });
      
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });
  });
});
