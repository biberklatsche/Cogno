import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { CommandLineObserver } from './command-line.observer';
import { TerminalStateManager } from '../state';
import { AppBus } from '../../../app-bus/app-bus';
import { Terminal } from '@xterm/xterm';

describe('CommandLineObserver', () => {
  let observer: CommandLineObserver;
  let mockTerminal: any;
  let stateManager: TerminalStateManager;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    stateManager = new TerminalStateManager(terminalId, 'Bash' as any, mockBus);
    observer = new CommandLineObserver(stateManager, []);
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

    stateManager.endCommand();
    onKeyCallback({ key: '\r', domEvent: {} as any });
    expect(stateManager.isCommandRunning).toBe(true);

    stateManager.endCommand();
    onKeyCallback({ key: '\n', domEvent: {} as any });
    expect(stateManager.isCommandRunning).toBe(true);
  });

  it('should update sessionState.input when terminal is parsed and command is not running', () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    // Mock terminal buffer
    const promptLine = TerminalMockFactory.createLine('^^#1 COGNO: /path $ ');
    const inputLine = TerminalMockFactory.createLine('ls -la');
    
    vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
        if (index === 0) return promptLine;
        if (index === 1) return inputLine;
        return null;
    });
    mockTerminal.buffer.active.length = 2;
    
    // Set cursor position and maxCursorIndex in session state
    stateManager.updateInput({ text: '', cursorIndex: 0, maxCursorIndex: 6 });
    stateManager.endCommand();

    onWriteParsedCallback();

    expect(stateManager.input.text).toBe('ls -la');
  });

  it('should NOT update sessionState.input when command is running', () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    stateManager.startCommand();
    stateManager.updateInput({ text: 'old input', cursorIndex: 0, maxCursorIndex: 9 });

    onWriteParsedCallback();

    expect(stateManager.input.text).toBe('old input');
  });

  it('should NOT update cursorIndex when command is running', () => {
    observer.registerTerminal(mockTerminal);
    const onCursorMoveCallback = vi.mocked(mockTerminal.onCursorMove).mock.calls[0][0];

    stateManager.startCommand();
    stateManager.updateInput({ text: '', cursorIndex: 10, maxCursorIndex: 10 });

    onCursorMoveCallback();

    expect(stateManager.input.cursorIndex).toBe(10);
  });

  it('should NOT refresh markers on render when command is running', () => {
    // @ts-ignore - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, 'refreshMarkers');
    observer.registerTerminal(mockTerminal);
    const onRenderCallback = vi.mocked(mockTerminal.onRender).mock.calls[0][0];

    stateManager.startCommand();
    onRenderCallback({ start: 0, end: 10 });

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('should NOT refresh markers on scroll when command is running', () => {
    // @ts-ignore - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, 'refreshMarkers');
    observer.registerTerminal(mockTerminal);
    const onScrollCallback = vi.mocked(mockTerminal.onScroll).mock.calls[0][0];

    stateManager.startCommand();
    onScrollCallback(0);

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('should NOT refresh markers on resize when command is running', () => {
    // @ts-ignore - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, 'refreshMarkers');
    observer.registerTerminal(mockTerminal);
    const onResizeCallback = vi.mocked(mockTerminal.onResize).mock.calls[0][0];

    stateManager.startCommand();
    onResizeCallback({ cols: 100, rows: 40 });

    expect(refreshSpy).not.toHaveBeenCalled();
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

  it('should register OSC handler for 733', () => {
    observer.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(733, expect.any(Function));
  });

  it('should update sessionState.isCommandRunning to false when OSC 733 is received', () => {
    observer.registerTerminal(mockTerminal);
    stateManager.startCommand();

    // We need to have a command already in the list for the OSC 733 to update it
    stateManager.updateCommandList({
      id: '7',
      user: 'larswolfram',
      machine: 'Air',
      directory: '/Users/lars'
    });

    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    const data = 'COGNO:PROMPT;returnCode=0;user=larswolfram;machine=Air;directory=/Users/lars;id=8;command=ls;';
    const result = oscHandler(data);

    expect(stateManager.isCommandRunning).toBe(false);
    expect(result).toBe(true);
    expect(stateManager.commands.length).toBe(2);
    expect(stateManager.commands[0].command).toBe('ls');
    expect(stateManager.commands[0].directory).toBe('/Users/lars');
    expect(stateManager.commands[0].returnCode).toBe(0);
    expect(stateManager.commands[0].id).toBe('7');
    expect(stateManager.commands[0].user).toBe('larswolfram');
  });

  it('should dispose registered OSC handler', () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });

    observer.registerTerminal(mockTerminal);
    observer.dispose();

    expect(disposeSpy).toHaveBeenCalled();
  });
});
