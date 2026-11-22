import type { IPty } from "@cogno/core/terminal/pty";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withExpectedCursor } from "../../../__test__/mocks/expected-cursor.mock";
import type { SessionModel } from "../model/session-model";
import { TerminalInputWriter } from "./input-writer";

describe("TerminalInputWriter", () => {
  let mockPty: IPty;
  let stateManager: SessionModel;
  let inputState: { text: string; cursorIndex: number; maxCursorIndex: number };
  let onUserInput: ReturnType<typeof vi.fn<() => void>>;
  let inputWriter: TerminalInputWriter;

  beforeEach(() => {
    mockPty = {
      write: vi.fn(),
      executeLineEditorAction: vi.fn(),
    } as unknown as IPty;
    inputState = { text: "hello", cursorIndex: 5, maxCursorIndex: 5 };
    stateManager = withExpectedCursor({
      get input() {
        return inputState;
      },
      sessionCapabilities: undefined,
      startCommand: vi.fn(),
    }) as unknown as SessionModel;
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

  describe("expected cursor", () => {
    beforeEach(() => {
      inputState = { text: "hello", cursorIndex: 2, maxCursorIndex: 5 };
    });

    it("expects the cursor where the moves it sent will end", () => {
      inputWriter.moveCursor(1);
      inputWriter.moveCursor(1);

      expect(stateManager.editingCursorIndex).toBe(4);
    });

    it("does not expect the cursor outside the line", () => {
      inputWriter.moveCursor(9);
      expect(stateManager.editingCursorIndex).toBe(5);

      inputWriter.moveCursor(-9);
      expect(stateManager.editingCursorIndex).toBe(0);
    });

    it("follows the cursor back behind trailing blanks the read text does not show", () => {
      // "git " reads as "git"; the shell has echoed two moves to the left.
      inputState = { text: "git", cursorIndex: 2, maxCursorIndex: 4 };

      inputWriter.moveCursor(2);

      expect(stateManager.editingCursorIndex).toBe(4);
    });

    it.each([
      ["a deletion", () => inputWriter.deleteChars(0, 1)],
      ["raw input", () => inputWriter.writeRaw("x")],
      ["a native action", () => inputWriter.executeNativeAction("goToNextWord")],
      ["a replaced input", () => inputWriter.replaceInput("ls", 2)],
    ])("goes back to the reported position after %s", (_name, write) => {
      inputWriter.moveCursor(2);

      write();

      expect(stateManager.editingCursorIndex).toBe(2);
    });

    it("clears the input from where the cursor will be, not from where it was reported", () => {
      inputWriter.moveCursor(3);
      vi.mocked(mockPty.write).mockClear();

      inputWriter.replaceInput("ls", 2);

      // At the end of "hello" already: no move, five backspaces.
      expect(mockPty.write).toHaveBeenNthCalledWith(1, "\b".repeat(5));
    });
  });

  it("works without an onUserInput hook", () => {
    const writerWithoutHook = new TerminalInputWriter(mockPty, stateManager);

    expect(() => {
      writerWithoutHook.moveCursor(1);
      writerWithoutHook.writeRaw("x");
    }).not.toThrow();
  });
});
