import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { InputHandler } from './input.handler';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';
import { Clipboard } from '@cogno/app-tauri/clipboard';
import {TerminalStateManager} from "../state";
import {Char} from "../../../common/chars/chars";
import {IPty} from "../pty/pty";
import { ShellLineEditorDefinitionContract } from "@cogno/core-api";

vi.mock('@cogno/app-tauri/clipboard', () => ({
  Clipboard: {
    readText: vi.fn(),
  },
}));

describe('InputHandler', () => {
  let handler: InputHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockStateManager: Pick<TerminalStateManager, 'clearUnreadNotification' | 'input' | 'isCommandRunning'>;
  let mockPty: Pick<IPty, 'write' | 'executeShellAction'>;
  let lineEditor: ShellLineEditorDefinitionContract | undefined;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    mockStateManager = {
      clearUnreadNotification: vi.fn(),
      isCommandRunning: false,
      input: {
        text: 'hello world',
        cursorIndex: 5,
        maxCursorIndex: 11
      }
    };
    mockPty = {
      write: vi.fn(),
      executeShellAction: vi.fn(),
    };
    lineEditor = undefined;
    handler = new InputHandler(mockBus, terminalId, mockStateManager as TerminalStateManager, mockPty as IPty, lineEditor);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe('registration', () => {
    it('should register for bus events', () => {
      const subscribeSpy = vi.spyOn(mockBus, 'on$');
      handler.registerTerminal(mockTerminal);
      expect(subscribeSpy).toHaveBeenCalled();
    });

    it('should clear unread notification when terminal data is entered', () => {
      let terminalOnDataCallback: ((data: string) => void) | undefined;
      mockTerminal = TerminalMockFactory.createTerminal({
        onData: (callback) => {
          terminalOnDataCallback = callback;
          return { dispose: vi.fn() };
        }
      });

      handler.registerTerminal(mockTerminal);
      terminalOnDataCallback?.('ls');

      expect(mockStateManager.clearUnreadNotification).toHaveBeenCalled();
    });
  });

  describe('bus events', () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
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

    it('should paste clipboard text when Paste event for this id is received', async () => {
      const pasteSpy = vi.spyOn(mockTerminal, 'paste');
      vi.mocked(Clipboard.readText).mockResolvedValue('pasted content');

      mockBus.publish({ type: 'Paste', payload: terminalId, path: ['app', 'terminal'] });

      // Wait for async clipboard read
      await vi.waitFor(() => expect(pasteSpy).toHaveBeenCalledWith('pasted content'));
    });

    it('should replace selected input with clipboard text when pasting', async () => {
      const pasteSpy = vi.spyOn(mockTerminal, 'paste');
      mockTerminal.cols = 80;
      mockTerminal.buffer.active.length = 2;
      const promptLine = TerminalMockFactory.createLine('^^#1 COGNO: / $ ');
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
        if (index === 0) return promptLine;
        return null;
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 5, y: 1 }
      });
      vi.mocked(Clipboard.readText).mockResolvedValue('bye');

      mockBus.publish({ type: 'Paste', payload: terminalId, path: ['app', 'terminal'] });

      await vi.waitFor(() => {
        expect(mockPty.write).toHaveBeenNthCalledWith(1, '\x08'.repeat(5));
        expect(mockPty.write).toHaveBeenNthCalledWith(2, 'bye');
      });
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it('should replace only the selected input range with native input replacement when available', async () => {
      lineEditor = { nativeActionsViaShellIntegration: ['replaceCurrentInput'] };
      handler = new InputHandler(
        mockBus,
        terminalId,
        mockStateManager as TerminalStateManager,
        mockPty as IPty,
        lineEditor,
      );
      handler.registerTerminal(mockTerminal);

      const pasteSpy = vi.spyOn(mockTerminal, 'paste');
      mockStateManager.input = {
        text: 'aaa bbb ccc',
        cursorIndex: 11,
        maxCursorIndex: 11,
      };
      mockTerminal.cols = 80;
      mockTerminal.buffer.active.length = 2;
      const promptLine = TerminalMockFactory.createLine('^^#1 COGNO: / $ ');
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
        if (index === 0) return promptLine;
        return null;
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 4, y: 1 },
        end: { x: 7, y: 1 }
      });
      vi.mocked(Clipboard.readText).mockResolvedValue('ccc');

      mockBus.publish({ type: 'Paste', payload: terminalId, path: ['app', 'terminal'] });

      await vi.waitFor(() => {
        expect(mockPty.executeShellAction).toHaveBeenCalledWith('replaceCurrentInput', {
          text: 'aaa ccc ccc',
          cursorIndex: 7,
        });
      });
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it('should not paste clipboard text when Paste event for other id is received', async () => {
      const pasteSpy = vi.spyOn(mockTerminal, 'paste');
      vi.mocked(Clipboard.readText).mockResolvedValue('pasted content');

      mockBus.publish({ type: 'Paste', payload: 'other-id', path: ['app', 'terminal'] });

      // Small delay to ensure it didn't happen
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(pasteSpy).not.toHaveBeenCalled();
    });

    it('should inject terminal input when InjectTerminalInput event for this id is received', () => {
      const writeSpy = vi.spyOn(mockPty, 'write');
      mockBus.publish({
        type: 'InjectTerminalInput',
        path: ['app', 'terminal'],
        payload: {
          terminalId,
          text: 'hello from telegram'
        }
      });

      expect(writeSpy).toHaveBeenCalledWith('hello from telegram');
    });

    it('should append Enter when InjectTerminalInput event requests execution', async () => {
      const writeSpy = vi.spyOn(mockPty, 'write');
      mockBus.publish({
        type: 'InjectTerminalInput',
        path: ['app', 'terminal'],
        payload: {
          terminalId,
          text: 'run this',
          appendNewline: true
        }
      });

      expect(writeSpy).toHaveBeenNthCalledWith(1, 'run this');
      await vi.waitFor(() => {
        expect(writeSpy).toHaveBeenNthCalledWith(2, Char.Enter);
      });
    });
  });

  describe('Lifecycle', () => {
    it('should unsubscribe on dispose', () => {
      const clearSpy = vi.spyOn(mockTerminal, 'clear');
      handler.registerTerminal(mockTerminal);
      handler.dispose();

      mockBus.publish({ type: 'ClearBuffer', payload: terminalId, path: ['app', 'terminal'] });
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});



