import type { ContextMenuOverlayService } from "@cogno/core-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../../app-bus/app-bus";
import { TerminalStateManager } from "../../state";
import { CommandLineObserver } from "./command-line.observer";

describe("CommandLineObserver", () => {
  let observer: CommandLineObserver;
  let mockTerminal: any;
  let stateManager: TerminalStateManager;
  let mockBus: AppBus;
  let contextMenuOverlayService: Pick<ContextMenuOverlayService, "openAtElement">;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    vi.useFakeTimers();
    mockBus = new AppBus();
    vi.spyOn(mockBus, "publish");
    stateManager = new TerminalStateManager(mockBus);
    stateManager.initialize(terminalId, "Bash" as any);
    contextMenuOverlayService = {
      openAtElement: vi.fn(),
    };
    observer = new CommandLineObserver(stateManager, [], contextMenuOverlayService, mockBus);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  afterEach(() => {
    vi.useRealTimers();
    observer.dispose();
  });

  it("should register onWriteParsed and onKey listeners", () => {
    observer.registerTerminal(mockTerminal);
    expect(mockTerminal.onWriteParsed).toHaveBeenCalled();
    expect(mockTerminal.onKey).toHaveBeenCalled();
  });

  it("should refresh markers on render after debounce time", () => {
    // @ts-expect-error - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, "refreshMarkers");
    observer.registerTerminal(mockTerminal);
    const onRenderCallback = vi.mocked(mockTerminal.onRender).mock.calls[0][0];

    onRenderCallback({ start: 0, end: 10 });
    expect(refreshSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it("should set isCommandRunning to true on Enter key", () => {
    observer.registerTerminal(mockTerminal);
    const onKeyCallback = vi.mocked(mockTerminal.onKey).mock.calls[0][0];

    stateManager.endCommand();
    onKeyCallback({ key: "\r", domEvent: {} as any });
    expect(stateManager.isCommandRunning).toBe(true);

    stateManager.endCommand();
    onKeyCallback({ key: "\n", domEvent: {} as any });
    expect(stateManager.isCommandRunning).toBe(true);
  });

  describe("ghost-text bound shrinking on deletion", () => {
    function fireKey(key: string): void {
      const onKeyCallback = vi.mocked(mockTerminal.onKey).mock.calls[0][0];
      onKeyCallback({ key: "\x7f", domEvent: { key } as KeyboardEvent });
    }

    beforeEach(() => {
      observer.registerTerminal(mockTerminal);
      stateManager.endCommand();
    });

    it("shrinks maxCursorIndex by one on Backspace", () => {
      // "git" typed, then deleted back from a longer input: the stale bound
      // (10) would let re-rendered ghost text leak into the read window.
      stateManager.updateInput({ text: "git", cursorIndex: 3, maxCursorIndex: 10 });

      fireKey("Backspace");

      expect(stateManager.input.maxCursorIndex).toBe(9);
    });

    it("does not shrink below the post-delete cursor position", () => {
      stateManager.updateInput({ text: "git", cursorIndex: 3, maxCursorIndex: 3 });

      fireKey("Backspace");

      expect(stateManager.input.maxCursorIndex).toBe(2);
    });

    it("ignores Backspace at the start of the input", () => {
      stateManager.updateInput({ text: "git", cursorIndex: 0, maxCursorIndex: 5 });

      fireKey("Backspace");

      expect(stateManager.input.maxCursorIndex).toBe(5);
    });

    it("shrinks on Delete when input follows the cursor", () => {
      stateManager.updateInput({ text: "gitx", cursorIndex: 1, maxCursorIndex: 4 });

      fireKey("Delete");

      expect(stateManager.input.maxCursorIndex).toBe(3);
    });

    it("ignores Delete at the end of the input", () => {
      stateManager.updateInput({ text: "git", cursorIndex: 3, maxCursorIndex: 3 });

      fireKey("Delete");

      expect(stateManager.input.maxCursorIndex).toBe(3);
    });

    it("does not shrink while a command is running", () => {
      stateManager.updateInput({ text: "git", cursorIndex: 3, maxCursorIndex: 10 });
      stateManager.startCommand();
      stateManager.updateInput({ text: "git", cursorIndex: 3, maxCursorIndex: 10 });

      fireKey("Backspace");

      expect(stateManager.input.maxCursorIndex).toBe(10);
    });
  });

  it("should update sessionState.input when terminal is parsed and command is not running", () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    // Mock terminal buffer
    const promptLine = TerminalMockFactory.createLine("^^#1 COGNO: /path $ ");
    const inputLine = TerminalMockFactory.createLine("ls -la");

    vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
      if (index === 0) return promptLine;
      if (index === 1) return inputLine;
      return null;
    });
    mockTerminal.buffer.active.length = 2;

    // Set cursor position and maxCursorIndex in session state
    stateManager.updateInput({ text: "", cursorIndex: 0, maxCursorIndex: 6 });
    stateManager.endCommand();

    onWriteParsedCallback();

    expect(stateManager.input.text).toBe("ls -la");
  });

  it("should NOT update sessionState.input when command is running", () => {
    observer.registerTerminal(mockTerminal);
    const onWriteParsedCallback = vi.mocked(mockTerminal.onWriteParsed).mock.calls[0][0];

    stateManager.startCommand();
    stateManager.updateInput({ text: "old input", cursorIndex: 0, maxCursorIndex: 9 });

    onWriteParsedCallback();

    expect(stateManager.input.text).toBe("old input");
  });

  it("should NOT update cursorIndex when command is running", () => {
    observer.registerTerminal(mockTerminal);
    const onCursorMoveCallback = vi.mocked(mockTerminal.onCursorMove).mock.calls[0][0];

    stateManager.startCommand();
    stateManager.updateInput({ text: "", cursorIndex: 10, maxCursorIndex: 10 });

    // Advance time past debounce period to ensure debounce is not the reason for skipping
    vi.advanceTimersByTime(150);

    onCursorMoveCallback();

    expect(stateManager.input.cursorIndex).toBe(10);
  });

  it("should NOT update cursorIndex during active typing (within debounce period)", () => {
    observer.registerTerminal(mockTerminal);
    const onCursorMoveCallback = vi.mocked(mockTerminal.onCursorMove).mock.calls[0][0];
    const onKeyCallback = vi.mocked(mockTerminal.onKey).mock.calls[0][0];

    // Mock terminal buffer
    const promptLine = TerminalMockFactory.createLine("^^#1 COGNO: /path $ ");
    const inputLine = TerminalMockFactory.createLine("some input text");
    vi.mocked(mockTerminal.buffer.active.getLine).mockImplementation((index: number) => {
      if (index === 0) return promptLine;
      if (index === 1) return inputLine;
      return null;
    });
    mockTerminal.buffer.active.length = 2;
    mockTerminal.buffer.active.viewportY = 0;
    mockTerminal.buffer.active.cursorY = 1;
    mockTerminal.buffer.active.cursorX = 5;

    stateManager.endCommand();
    stateManager.updateInput({ text: "", cursorIndex: 5, maxCursorIndex: 5 });

    // Simulate a keystroke
    onKeyCallback({ key: "a", domEvent: {} as any });

    // Try to update cursor position immediately after keystroke
    onCursorMoveCallback();

    // Cursor should not have been updated (still at 5)
    expect(stateManager.input.cursorIndex).toBe(5);

    // After debounce period, cursor updates should work again
    vi.advanceTimersByTime(150);
    mockTerminal.buffer.active.cursorX = 10;
    onCursorMoveCallback();

    expect(stateManager.input.cursorIndex).toBe(10);
  });

  it("should refresh markers on render (debounced)", () => {
    // @ts-expect-error - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, "refreshMarkers");
    observer.registerTerminal(mockTerminal);
    const onRenderCallback = vi.mocked(mockTerminal.onRender).mock.calls[0][0];

    onRenderCallback({ start: 0, end: 10 });
    // Should not be called immediately
    expect(refreshSpy).not.toHaveBeenCalled();

    // Should be called after debounce time
    vi.advanceTimersByTime(20);
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it("should refresh markers on scroll (debounced)", () => {
    // @ts-expect-error - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, "refreshMarkers");
    observer.registerTerminal(mockTerminal);
    const onScrollCallback = vi.mocked(mockTerminal.onScroll).mock.calls[0][0];

    onScrollCallback(0);
    // Should not be called immediately
    expect(refreshSpy).not.toHaveBeenCalled();

    // Should be called after debounce time
    vi.advanceTimersByTime(20);
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it("should refresh markers on resize (immediate)", () => {
    // @ts-expect-error - access private markerManager for spying
    const refreshSpy = vi.spyOn(observer._markerManager, "refreshMarkers");
    observer.registerTerminal(mockTerminal);
    const onResizeCallback = vi.mocked(mockTerminal.onResize).mock.calls[0][0];

    onResizeCallback({ cols: 100, rows: 40 });
    // Resize should refresh immediately
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it("should dispose listeners on dispose", () => {
    const parsedDispose = vi.fn();
    const keyDispose = vi.fn();
    vi.mocked(mockTerminal.onWriteParsed).mockReturnValue({ dispose: parsedDispose });
    vi.mocked(mockTerminal.onKey).mockReturnValue({ dispose: keyDispose });

    observer.registerTerminal(mockTerminal);
    observer.dispose();

    expect(parsedDispose).toHaveBeenCalled();
    expect(keyDispose).toHaveBeenCalled();
  });

  it("should register OSC handler for 733", () => {
    observer.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(733, expect.any(Function));
  });

  it("should update sessionState.isCommandRunning to false when OSC 733 is received", () => {
    observer.registerTerminal(mockTerminal);
    stateManager.startCommand();

    // We need to have a command already in the list for the OSC 733 to update it
    stateManager.updateCommand({
      id: "7",
      user: "larswolfram",
      machine: "Air",
      directory: "/Users/lars",
    });

    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    const data =
      "COGNO:PROMPT;returnCode=0;user=larswolfram;machine=Air;directory=/Users/lars;id=8;command=ls;";
    const result = oscHandler(data);

    expect(stateManager.isCommandRunning).toBe(false);
    expect(result).toBe(true);
    expect(stateManager.commands.length).toBe(2);
    expect(stateManager.commands[0].command).toBe("ls");
    expect(stateManager.commands[0].directory).toBe("/Users/lars");
    expect(stateManager.commands[0].returnCode).toBe(0);
    expect(stateManager.commands[0].id).toBe("7");
    expect(stateManager.commands[0].user).toBe("larswolfram");
  });

  it("should store session capabilities from a COGNO:CAPS handshake", () => {
    observer.registerTerminal(mockTerminal);

    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    const result = oscHandler(
      "COGNO:CAPS;shell=zsh;shellVersion=5.9;nativeActions=replaceCurrentInput;bracketedPaste=true;",
    );

    expect(result).toBe(true);
    expect(stateManager.sessionCapabilities).toEqual({
      shellVersion: "5.9",
      nativeActions: ["replaceCurrentInput"],
      bracketedPaste: true,
      degradedReason: undefined,
    });
  });

  it("should not run the prompt logic for a COGNO:CAPS handshake", () => {
    observer.registerTerminal(mockTerminal);
    stateManager.startCommand();
    const publishSpy = vi.spyOn(mockBus, "publish");
    publishSpy.mockClear();

    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    oscHandler("COGNO:CAPS;shell=bash;shellVersion=3.2;degraded=bash-version;");

    // The handshake must neither end the running command nor request a
    // cursor restore — that is prompt-cycle behavior.
    expect(stateManager.isCommandRunning).toBe(true);
    expect(publishSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "TerminalCursorRestoreRequested" }),
    );
    expect(stateManager.sessionCapabilities?.degradedReason).toBe("bash-version");
  });

  it("should publish cursor restore request when OSC 733 is received", () => {
    observer.registerTerminal(mockTerminal);
    const publishSpy = vi.spyOn(mockBus, "publish");

    publishSpy.mockClear();
    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    oscHandler("COGNO:PROMPT;returnCode=0;id=1;command=fresh;");

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal", terminalId],
        type: "TerminalCursorRestoreRequested",
      }),
    );
  });

  it("should dispose registered OSC handler", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });

    observer.registerTerminal(mockTerminal);
    observer.dispose();

    expect(disposeSpy).toHaveBeenCalled();
  });
});
