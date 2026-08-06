import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalInputWriter } from "./input-writer";
import type { IPty } from "./pty/pty";
import type { TerminalStateManager } from "./state";

describe("TerminalInputWriter", () => {
  let mockPty: IPty;
  let stateManager: TerminalStateManager;
  let inputState: { text: string; cursorIndex: number; maxCursorIndex: number };
  let onUserInput: ReturnType<typeof vi.fn<() => void>>;
  let inputWriter: TerminalInputWriter;

  beforeEach(() => {
    mockPty = {
      write: vi.fn(),
      executeLineEditorAction: vi.fn(),
    } as unknown as IPty;
    inputState = { text: "hello", cursorIndex: 5, maxCursorIndex: 5 };
    stateManager = {
      get input() {
        return inputState;
      },
      sessionCapabilities: undefined,
      startCommand: vi.fn(),
    } as unknown as TerminalStateManager;
    onUserInput = vi.fn<() => void>();
    inputWriter = new TerminalInputWriter(mockPty, stateManager, undefined, onUserInput);
  });

  it("notifies onUserInput when the cursor moves", () => {
    inputWriter.moveCursor(2);

    expect(mockPty.write).toHaveBeenCalledWith("\x1b[C\x1b[C");
    expect(onUserInput).toHaveBeenCalledTimes(1);
  });

  it("does not notify onUserInput when the cursor move is a no-op", () => {
    inputWriter.moveCursor(0);

    expect(mockPty.write).not.toHaveBeenCalled();
    expect(onUserInput).not.toHaveBeenCalled();
  });

  it("notifies onUserInput when characters are deleted", () => {
    inputWriter.deleteChars(0, 3);

    expect(mockPty.write).toHaveBeenCalledWith("\b\b\b");
    expect(onUserInput).toHaveBeenCalledTimes(1);
  });

  it("does not notify onUserInput when the delete is a no-op", () => {
    inputWriter.deleteChars(2, 0);

    expect(mockPty.write).not.toHaveBeenCalled();
    expect(onUserInput).not.toHaveBeenCalled();
  });

  it("notifies onUserInput on raw writes", () => {
    inputWriter.writeRaw("x");

    expect(mockPty.write).toHaveBeenCalledWith("x");
    expect(onUserInput).toHaveBeenCalledTimes(1);
  });

  it("notifies onUserInput on native line-editor actions", () => {
    inputWriter.executeNativeAction("clearLine");

    expect(mockPty.executeLineEditorAction).toHaveBeenCalledWith("clearLine", undefined);
    expect(onUserInput).toHaveBeenCalledTimes(1);
  });

  it("notifies onUserInput when the input is replaced, even with an empty current input", () => {
    inputState = { text: "", cursorIndex: 0, maxCursorIndex: 0 };

    inputWriter.replaceInput("ls", 2);

    expect(mockPty.write).toHaveBeenCalledWith("ls");
    expect(onUserInput).toHaveBeenCalled();
  });

  it("works without an onUserInput hook", () => {
    const writerWithoutHook = new TerminalInputWriter(mockPty, stateManager);

    expect(() => {
      writerWithoutHook.moveCursor(1);
      writerWithoutHook.writeRaw("x");
    }).not.toThrow();
  });
});
