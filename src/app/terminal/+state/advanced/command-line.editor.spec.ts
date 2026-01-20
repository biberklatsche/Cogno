import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandLineEditor } from './command-line.editor';
import { AppBus } from '../../../app-bus/app-bus';
import { IPty } from '../pty/pty';
import { InternalState } from '../session.state';
import { Terminal } from '@xterm/xterm';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';

describe('CommandLineEditor', () => {
  let editor: CommandLineEditor;
  let mockBus: AppBus;
  let mockPty: IPty;
  let mockTerminal: any;
  let state: InternalState;
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
    } as any;
    editor = new CommandLineEditor(mockBus, mockPty, state);
    mockTerminal = TerminalMockFactory.createTerminal();
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
      const promptLine = TerminalMockFactory.createLine('COGNO: / $ ');
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

    it('should extend selection when selecting multiple times', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      
      // First selection (1 char right)
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      expect(mockTerminal.select).toHaveBeenCalledWith(0, 1, 1);
      
      // Update state as if cursor moved
      state.input.cursorIndex = 1;
      
      // Second selection (another char right)
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      // Should now select from 0 to 2
      expect(mockTerminal.select).toHaveBeenLastCalledWith(0, 1, 2);
    });

    it('should shrink selection when reversing direction', () => {
      state.input = { text: 'hello world', cursorIndex: 0, maxCursorIndex: 11 };
      
      // Select 2 chars right
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 1;
      mockBus.publish({ type: 'SelectTextRight', payload: terminalId, path: ['app', 'terminal'] });
      state.input.cursorIndex = 2;
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
  });
});
