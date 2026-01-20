import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { CommandLineObserver } from './command-line.observer';
import { SessionState } from '../session.state';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';

describe('InputObserver', () => {
  let observer: CommandLineObserver;
  let mockTerminal: any;
  let sessionState: SessionState;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    sessionState = new SessionState(terminalId, 'Bash' as any, mockBus);
    observer = new CommandLineObserver(sessionState);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it('should register onWriteParsed and onKey listeners', () => {
    observer.registerTerminal(mockTerminal);
    expect(mockTerminal.onWriteParsed).toHaveBeenCalled();
    expect(mockTerminal.onKey).toHaveBeenCalled();
  });

  it('should set isCommandRunning to true on Enter key', () => {
    observer.registerTerminal(mockTerminal);
    const onKeyCallback = vi.mocked(mockTerminal.onKey).mock.calls[0][0];

    sessionState.isCommandRunning = false;
    onKeyCallback({ key: '\r', domEvent: {} as any });
    expect(sessionState.isCommandRunning).toBe(true);

    sessionState.isCommandRunning = false;
    onKeyCallback({ key: '\n', domEvent: {} as any });
    expect(sessionState.isCommandRunning).toBe(true);
  });

  it('should update sessionState.input when terminal is parsed and command is not running', () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    // Mock terminal buffer
    const promptLine = TerminalMockFactory.createLine('COGNO: /path $ ');
    const inputLine = TerminalMockFactory.createLine('ls -la');
    
    vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
        if (index === 0) return promptLine;
        if (index === 1) return inputLine;
        return null;
    });
    mockTerminal.buffer.active.length = 2;
    
    // Set cursor position in session state
    sessionState.cursorPosition = { col: 7, row: 2, viewport: { col: 7, row: 2 }, char: '' };
    sessionState.isCommandRunning = false;

    onWriteParsedCallback();

    expect(sessionState.input).toBe('ls -la');
  });

  it('should NOT update sessionState.input when command is running', () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    sessionState.isCommandRunning = true;
    sessionState.input = 'old input';

    onWriteParsedCallback();

    expect(sessionState.input).toBe('old input');
  });

  it('should dispose listeners on dispose', () => {
    const parsedDispose = vi.fn();
    const keyDispose = vi.fn();
    vi.mocked(mockTerminal.onWriteParsed).mockReturnValue({ dispose: parsedDispose });
    vi.mocked(mockTerminal.onKey).mockReturnValue({ dispose: keyDispose });

    observer.registerTerminal(mockTerminal);
    observer.dispose();

    expect(parsedDispose).toHaveBeenCalled();
    expect(keyDispose).toHaveBeenCalled();
  });
});
