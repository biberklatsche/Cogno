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
});
