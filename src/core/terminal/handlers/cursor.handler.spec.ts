import type { IBufferCell } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import type {
  TerminalCursorPosition,
  TerminalMousePosition,
  TerminalViewportDimensions,
} from "../terminal-machine.state";
import { CursorHandler } from "./cursor.handler";

/** Records what the machine reports, which is all these handlers do. */
function createMachineState() {
  return {
    cursorPosition: undefined as TerminalCursorPosition | undefined,
    mousePosition: undefined as TerminalMousePosition | undefined,
    dimensions: undefined as TerminalViewportDimensions | undefined,
    hasSelection: false,
    scrolledLinesFromBottom: 0,
    updateCursorPosition(position: TerminalCursorPosition) {
      this.cursorPosition = position;
    },
    updateMousePosition(position: TerminalMousePosition) {
      this.mousePosition = position;
    },
    updateDimensions(dimensions: TerminalViewportDimensions) {
      this.dimensions = dimensions;
    },
    setHasSelection(hasSelection: boolean) {
      this.hasSelection = hasSelection;
    },
    setScrolledLinesFromBottom(lines: number) {
      this.scrolledLinesFromBottom = lines;
    },
  };
}

describe("CursorHandler", () => {
  let handler: CursorHandler;
  let stateManager: ReturnType<typeof createMachineState>;
  let cursorMoveCallback: (() => void) | null = null;

  beforeEach(() => {
    cursorMoveCallback = null;

    stateManager = createMachineState();
    handler = new CursorHandler(stateManager);
  });

  describe("register", () => {
    it("should register onCursorMove listener", () => {
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      expect(terminal.onCursorMove).toHaveBeenCalledTimes(1);
      expect(terminal.onCursorMove).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should return disposable when registered", () => {
      const disposable = { dispose: vi.fn() };
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable,
      });

      const result = handler.registerTerminal(terminal);

      expect(result).toBeDefined();
    });
  });

  describe("cursor position publishing", () => {
    it("should publish correct cursor position on move", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("  A"); // A at index 2
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition).toEqual(
        expect.objectContaining({
          char: "A",
          viewport: { col: 3, row: 4 },
          col: 3,
          row: 14,
        }),
      );
    });

    it("should handle cursor at origin (0, 0)", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 0,
        cursorY: 0,
        viewportY: 0,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("B");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition).toEqual(
        expect.objectContaining({
          viewport: { col: 1, row: 1 },
          char: "B",
          col: 1,
          row: 1,
        }),
      );
    });

    it("should handle different viewport offsets", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 5,
        cursorY: 5,
        viewportY: 100,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("X");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition!.row).toBe(106); // 5 + 100 + 1
    });

    it("should handle multi-character cells", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("  €"); // Euro at index 2
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition!.char).toBe("€");
    });

    it("should handle empty cells", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition!.char).toBe("");
    });
  });

  describe("error handling", () => {
    it("should use default values when buffer is missing", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      //@ts-expect-error - manual override for error case
      terminal.buffer = undefined;

      handler.registerTerminal(terminal);
      cursorMoveCallback?.();

      expect(stateManager.cursorPosition).toEqual(
        expect.objectContaining({
          char: "",
          col: 1,
          row: 1,
        }),
      );
    });

    it("should use default values when active buffer is missing", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      // @ts-expect-error - manual override for error case
      terminal.buffer.active = undefined;

      handler.registerTerminal(terminal);
      cursorMoveCallback?.();

      expect(stateManager.cursorPosition).toEqual(
        expect.objectContaining({
          char: "",
          col: 1,
          row: 1,
        }),
      );
    });

    it("should handle getLine throwing an error", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      vi.mocked(terminal.buffer.active.getLine).mockImplementation(() => {
        throw new Error("Buffer access error");
      });

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition).toEqual(
        expect.objectContaining({
          char: "", // Falls back to empty string on error
          viewport: { col: 3, row: 4 },
          col: 3,
          row: 14,
        }),
      );
    });

    it("should handle getLine returning null", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(null as any);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition!.char).toBe("");
    });

    it("should handle getCell returning null", async () => {
      const terminal = TerminalMockFactory.createTerminal({
        cursorX: 2,
        cursorY: 3,
        viewportY: 10,
        onCursorMove: (cb) => {
          cursorMoveCallback = cb;
          return { dispose: vi.fn() };
        },
      });
      handler.registerTerminal(terminal);

      const mockLine = TerminalMockFactory.createLine("ABC");
      vi.mocked(mockLine.getCell).mockReturnValue(null as unknown as IBufferCell);
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(mockLine);

      cursorMoveCallback?.();

      expect(stateManager.cursorPosition!.char).toBe("");
    });
  });

  describe("dispose", () => {
    it("should dispose the listener when dispose is called", () => {
      const disposable = { dispose: vi.fn() };
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable,
      });

      handler.registerTerminal(terminal);
      handler.dispose();

      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it("should handle dispose being called multiple times", () => {
      const disposable = { dispose: vi.fn() };
      const terminal = TerminalMockFactory.createTerminal({
        onCursorMove: () => disposable,
      });

      handler.registerTerminal(terminal);
      handler.dispose();
      handler.dispose();

      // Should only dispose once or handle gracefully
      expect(disposable.dispose).toHaveBeenCalled();
    });

    it("should handle dispose being called before register", () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
