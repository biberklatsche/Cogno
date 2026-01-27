import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandLineEditor } from './command-line.editor';
import { AppBus } from '../../../app-bus/app-bus';
import { IPty } from '../pty/pty';
import { TerminalStateManager } from '../../state';
import { Terminal } from '@xterm/xterm';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { Clipboard } from '../../../_tauri/clipboard';

vi.mock('../../../_tauri/clipboard', () => ({
  Clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(),
  }
}));

describe('CommandLineEditor', () => {
  let editor: CommandLineEditor;
  let mockBus: AppBus;
  let mockPty: IPty;
  let mockTerminal: any;
  let state: any;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    mockPty = {
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn(),
    } as any;
    state = {
      terminalId,
      isCommandRunning: false,
      input: { text: 'hello world example', cursorIndex: 6, maxCursorIndex: 19 },
      shellType: 'Bash' as any,
    };
    editor = new CommandLineEditor(mockBus, mockPty, state as any);
    mockTerminal = TerminalMockFactory.createTerminal();
    
    // Default mocks for selection
    vi.mocked(mockTerminal.hasSelection).mockReturnValue(false);
    vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue(undefined);

    editor.registerTerminal(mockTerminal);
  });

  it('should clear current input completely', () => {
    editor.clearCurrentInput();
    // hello world example (len 19), cursor at 6.
    // countToEnd = 19 - 6 = 13.
    // repeat(13) [C + repeat(19) backspace
    const expected = '\x1b[C'.repeat(13) + '\x08'.repeat(19);
    expect(mockPty.write).toHaveBeenCalledWith(expected);
  });

  it('should clear line to end', () => {
    mockBus.publish({ type: 'ClearLineToEnd', payload: terminalId, path: ['app', 'terminal'] });
    // text: 'hello world example' (len 19), cursor: 6 (at 'w')
    // to end: 13 chars
    // Implementation: repeat(13) [C + repeat(13) backspace
    const expected = '\x1b[C'.repeat(13) + '\x08'.repeat(13);
    expect(mockPty.write).toHaveBeenCalledWith(expected);
  });

  it('should clear line to start', () => {
    mockBus.publish({ type: 'ClearLineToStart', payload: terminalId, path: ['app', 'terminal'] });
    // cursor: 6. Implementation: repeat(6) backspace
    expect(mockPty.write).toHaveBeenCalledWith('\x08'.repeat(6));
  });

  it('should delete previous word', () => {
    state.input = { text: 'hello world example', cursorIndex: 12, maxCursorIndex: 19 }; // after 'world '
    mockBus.publish({ type: 'DeletePreviousWord', payload: terminalId, path: ['app', 'terminal'] });
    // 'world ' is 6 chars. Implementation: repeat(6) backspace
    expect(mockPty.write).toHaveBeenCalledWith('\x08'.repeat(6));
  });

  it('should delete next word', () => {
    state.input = { text: 'hello world example', cursorIndex: 6, maxCursorIndex: 19 }; // at 'w'
    mockBus.publish({ type: 'DeleteNextWord', payload: terminalId, path: ['app', 'terminal'] });
    // next word is 'world' (5 chars). Implementation: repeat(5) [C + repeat(5) backspace
    const expected = '\x1b[C'.repeat(5) + '\x08'.repeat(5);
    expect(mockPty.write).toHaveBeenCalledWith(expected);
  });

  it('should go to next word', () => {
    state.input = { text: 'hello world example', cursorIndex: 0, maxCursorIndex: 19 };
    mockBus.publish({ type: 'GoToNextWord', payload: terminalId, path: ['app', 'terminal'] });
    // 'hello' is 5 chars.
    expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(5));
  });

  it('should go to previous word', () => {
    state.input = { text: 'hello world example', cursorIndex: 11, maxCursorIndex: 19 }; // after 'world'
    mockBus.publish({ type: 'GoToPreviousWord', payload: terminalId, path: ['app', 'terminal'] });
    // 'world' is 5 chars.
    expect(mockPty.write).toHaveBeenCalledWith('\x1b[D'.repeat(5));
  });

  it('should not perform action if terminalId mismatch', () => {
    mockBus.publish({ type: 'ClearLineToEnd', payload: 'wrong-id', path: ['app', 'terminal'] });
    expect(mockPty.write).not.toHaveBeenCalled();
  });

  it('should not perform action if command is running', () => {
    state.isCommandRunning = true;
    mockBus.publish({ type: 'ClearLineToEnd', payload: terminalId, path: ['app', 'terminal'] });
    expect(mockPty.write).not.toHaveBeenCalled();
  });

  describe('Selection', () => {
    beforeEach(() => {
      mockTerminal.cols = 80;
      mockTerminal.buffer.active.length = 2;
      const promptLine = TerminalMockFactory.createLine('^^#1 COGNO: / $ ');
      vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
        if (index === 0) return promptLine;
        return null;
      });
    });

    it('should select text to the right and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      // startCol: 0%80=0, startRow: 0+1=1, length: 1
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 1);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C');
      
      // Simuliere dass xterm nun eine Selektion hat
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 1, y: 1 }
      });
    });

    it('should select text to the left and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 5, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectTextLeft', payload: terminalId, path: ['app', 'terminal'] });
      // newPos: 4, start: 4, length: 1. startCol: 4%80=4, startRow: 1, length: 1
      expect(mockTerminal.select).toHaveBeenCalledWith(4, 1, 1);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[D');
    });

    it('should select word to the right and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectWordRight', payload: terminalId, path: ['app', 'terminal'] });
      // next word 'hello' ends at 5. length: 5
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 5);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(5));
    });

    it('should select word to the left and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 11, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectWordLeft', payload: terminalId, path: ['app', 'terminal'] });
      // previous word 'world' starts at 6. length: 11-6=5. start: 6
      expect(mockTerminal.select).toHaveBeenCalledWith(6, 1, 5);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[D'.repeat(5));
    });

    it('should select text to end of line and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 6, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectTextToEndOfLine', payload: terminalId, path: ['app', 'terminal'] });
      // text length: 11. length: 11-6=5. start: 6
      expect(mockTerminal.select).toHaveBeenCalledWith(6, 1, 5);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(5));
    });

    it('should select text to start of line and move cursor', () => {
      state.input = { text: 'hello world', cursorIndex: 6, maxCursorIndex: 11 };
      mockBus.publish({ type: 'SelectTextToStartOfLine', payload: terminalId, path: ['app', 'terminal'] });
      // start: 0, length: 6
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 6);
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[D'.repeat(6));
    });

    it('should select all text and move cursor to end of line', async () => {
      state.input = { text: 'hello world', cursorIndex: 6, maxCursorIndex: 11 };
      
      mockBus.publish({ type: 'SelectAll', payload: terminalId, path: ['app', 'terminal'] });
      
      // Move to end: text len 11, cursor 6 -> move 5 right
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(5));
      
      // Should select from 0 to 11
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 11);
    });

    it('should extend selection when selecting multiple times', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      
      // First selection (1 char right)
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 1);
      
      // Simuliere xterm selektion nach erstem Schritt
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 1, y: 1 }
      });

      // Update state as if cursor moved
      state.input.cursorIndex = 1;
      
      // Second selection (another char right)
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      // Should now select from 0 to 2
      expect(mockTerminal.select).toHaveBeenLastCalledWith(0, 1, 2);
    });

    it('should shrink selection when reversing direction', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      
      // Select 1 char right
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 1;
      
      // Simuliere xterm selektion
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 1, y: 1 }
      });

      // Select another char right
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 2;
      
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 2, y: 1 }
      });

      expect(mockTerminal.select).toHaveBeenLastCalledWith(0, 1, 2);
      
      // Select 1 char left
      mockBus.publish({ type: 'SelectTextLeft', payload: terminalId, path: ['app', 'terminal'] });
      // Should now select from 0 to 1
      expect(mockTerminal.select).toHaveBeenLastCalledWith(0, 1, 1);
    });

    it('should reset selection start when moving cursor without shift', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      
      // Select 1 char right
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 1);
      state.input.cursorIndex = 1;

      // Move cursor without shift
      mockBus.publish({ type: 'GoToNextWord', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 5; // 'hello'

      // Select right again
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      // Should start new selection from 5 to 6
      expect(mockTerminal.select).toHaveBeenLastCalledWith(5, 1, 1);
    });

    it('should delete selection when Backspace is pressed', () => {
      state.input = { text: 'hello world', cursorIndex: 5, maxCursorIndex: 11 };
      
      // Mock xterm selection position (0-based)
      // Prompt ends at row 0 (0-based findLastCognoMarkerY), so input starts at row 1.
      // Index 0-5 means column 0 to 5 on row 1.
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 }, 
        end: { x: 5, y: 1 }    
      });
      
      // Get the custom key handler
      const customKeyHandler = vi.mocked(mockTerminal.attachCustomKeyEventHandler).mock.calls[0][0];
      
      // Simulate Backspace
      const event = { type: 'keydown', key: 'Backspace' } as KeyboardEvent;
      const result = customKeyHandler(event);
      
      expect(result).toBe(false); // Handled
      // Cursor was at 5. Range index 0 to 5. endIdx = 5. currentCursorIdx = 5.
      // Expected: write 5 backspaces.
      expect(mockPty.write).toHaveBeenLastCalledWith('\x08'.repeat(5));
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });

    it('should delete selection when Delete is pressed', () => {
      state.input = { text: 'hello world', cursorIndex: 6, maxCursorIndex: 11 };
      
      // Select index 6 to 11 ('world')
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 6, y: 1 }, 
        end: { x: 11, y: 1 }    
      });
      
      const customKeyHandler = vi.mocked(mockTerminal.attachCustomKeyEventHandler).mock.calls[0][0];
      
      // Simulate Delete
      const event = { type: 'keydown', key: 'Delete' } as KeyboardEvent;
      const result = customKeyHandler(event);
      
      expect(result).toBe(false); // Handled
      // endIdx=11, currentPos=6. cursorOffsetToEnd = 11 - 6 = 5.
      // Expected: move right 5 times, then 5 backspaces.
      expect(mockPty.write).toHaveBeenLastCalledWith('\x1b[C'.repeat(5) + '\x08'.repeat(5));
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });

    it('should copy selection to clipboard and delete it when Cut action is fired', async () => {
      state.input = { text: 'hello world', cursorIndex: 5, maxCursorIndex: 11 };
      
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 }, 
        end: { x: 5, y: 1 }    
      });
      vi.mocked(mockTerminal.getSelection).mockReturnValue('hello');
      
      mockBus.publish({ type: 'Cut', payload: terminalId, path: ['app', 'terminal'] });
      
      expect(Clipboard.writeText).toHaveBeenCalledWith('hello');
      // Cursor was at 5. Range index 0 to 5. endIdx = 5. currentCursorIdx = 5.
      // Expected: write 5 backspaces.
      expect(mockPty.write).toHaveBeenLastCalledWith('\x08'.repeat(5));
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });

    it('should not delete selection if it is outside of input area', () => {
      state.input = { text: 'hello', cursorIndex: 5, maxCursorIndex: 5 };
      
      // Selection on row 0 (prompt area)
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 0 }, 
        end: { x: 5, y: 0 }    
      });
      
      const customKeyHandler = vi.mocked(mockTerminal.attachCustomKeyEventHandler).mock.calls[0][0];
      const event = { type: 'keydown', key: 'Backspace' } as KeyboardEvent;
      const result = customKeyHandler(event);
      
      expect(result).toBe(true); // Should return true to let xterm handle it
      expect(mockPty.write).not.toHaveBeenCalled();
    });

    it('should not delete selection if command is running', () => {
      state.isCommandRunning = true;
      state.input = { text: 'hello', cursorIndex: 0, maxCursorIndex: 5 };
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      
      const customKeyHandler = vi.mocked(mockTerminal.attachCustomKeyEventHandler).mock.calls[0][0];
      const event = { type: 'keydown', key: 'Backspace' } as KeyboardEvent;
      const result = customKeyHandler(event);
      
      expect(result).toBe(true); // Not handled by custom handler
      expect(mockPty.write).not.toHaveBeenCalledWith('\x08');
    });

    it('should dispose selection listener on dispose', () => {
      const selectionDispose = vi.fn();
      vi.mocked(mockTerminal.onSelectionChange).mockReturnValue({ dispose: selectionDispose });

      editor.registerTerminal(mockTerminal);
      editor.dispose();

      expect(selectionDispose).toHaveBeenCalled();
    });

    it('should handle findLastCognoMarkerY when no marker is present', () => {
      vi.mocked(mockTerminal.buffer.active.getLine).mockReturnValue({
        translateToString: () => 'some random line without marker'
      });
      
      // selectTextRight internally calls findLastCognoMarkerY
      state.input = { text: 'test', cursorIndex: 0, maxCursorIndex: 4 };
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      
      // findLastCognoMarkerY returns -1. startInputY = -1 + 1 = 0.
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 0, 1);
    });

    it('should handle findLastCognoMarkerY when buffer is not active', () => {
      const originalBuffer = mockTerminal.buffer;
      mockTerminal.buffer = { active: null }; // Mock active as null
      
      state.input = { text: 'test', cursorIndex: 0, maxCursorIndex: 4 };
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      
      expect(mockTerminal.select).not.toHaveBeenCalled();
      mockTerminal.buffer = originalBuffer;
    });

    it('should handle findPreviousWordStart with leading separators', () => {
      state.input = { text: '   abc', cursorIndex: 6, maxCursorIndex: 6 };
      mockBus.publish({ type: 'DeletePreviousWord', payload: terminalId, path: ['app', 'terminal'] });
      
      // '   abc' has 3 separators and 3 chars. 
      // Starting at 6: skips nothing (it's at end), then finds 'abc' (3 chars), stops at index 3.
      // Wait, '   abc' indices: 0:' ', 1:' ', 2:' ', 3:'a', 4:'b', 5:'c'. length 6.
      // cursor at 6. pos = 5 ('c'). not separator. while(!separator) pos-- until pos is 2.
      // returns pos + 1 = 3.
      // count = 6 - 3 = 3.
      expect(mockPty.write).toHaveBeenCalledWith('\x08'.repeat(3));
    });

    it('should handle findPreviousWordStart with only separators', () => {
      state.input = { text: '   ', cursorIndex: 3, maxCursorIndex: 3 };
      mockBus.publish({ type: 'DeletePreviousWord', payload: terminalId, path: ['app', 'terminal'] });
      
      // pos = 2 (' '). is separator. while(separator) pos-- until -1.
      // returns -1 + 1 = 0. count = 3.
      expect(mockPty.write).toHaveBeenCalledWith('\x08'.repeat(3));
    });

    it('should handle findNextWordEnd with trailing separators', () => {
      state.input = { text: 'abc   ', cursorIndex: 0, maxCursorIndex: 6 };
      mockBus.publish({ type: 'DeleteNextWord', payload: terminalId, path: ['app', 'terminal'] });
      
      // starts at 0 ('a'). not separator. while(!separator) pos++ until 3.
      // returns 3.
      // count = 3 - 0 = 3.
      // implementation of DeleteNextWord moves to end of word then backspaces.
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(3) + '\x08'.repeat(3));
    });

    it('should handle findNextWordEnd with only separators', () => {
      state.input = { text: '   ', cursorIndex: 0, maxCursorIndex: 3 };
      mockBus.publish({ type: 'DeleteNextWord', payload: terminalId, path: ['app', 'terminal'] });
      
      // starts at 0 (' '). is separator. while(separator) pos++ until 3.
      // returns 3.
      expect(mockPty.write).toHaveBeenCalledWith('\x1b[C'.repeat(3) + '\x08'.repeat(3));
    });

    it('should do nothing in deleteSelection if length is 0', () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 5, y: 1 },
        end: { x: 5, y: 1 }
      });
      
      const customKeyHandler = vi.mocked(mockTerminal.attachCustomKeyEventHandler).mock.calls[0][0];
      const event = { type: 'keydown', key: 'Backspace' } as KeyboardEvent;
      const result = customKeyHandler(event);
      
      expect(result).toBe(false); // Handled
      expect(mockPty.write).not.toHaveBeenCalled();
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });

    it('should handle multi-line input in select (simple wrap)', () => {
      mockTerminal.cols = 10;
      state.input = { text: '0123456789ABCDEF', cursorIndex: 0, maxCursorIndex: 16 };
      
      // Select 1 char right. cursor moved to 1.
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 1;
      
      // Simuliere xterm selektion
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelectionPosition).mockReturnValue({
        start: { x: 0, y: 1 },
        end: { x: 1, y: 1 }
      });

      // Select another 11 chars right (total 12).
      // next word '0123456789ABCDEF' (all one word because no separators)
      // SelectWordRight will move cursor to end of word (16)
      mockBus.publish({ type: 'SelectWordRight', payload: terminalId, path: ['app', 'terminal'] });

      // startIdx=0, endIdx=16. length=16.
      expect(mockTerminal.select).toHaveBeenLastCalledWith(0, 1, 16);
    });
  });
});
