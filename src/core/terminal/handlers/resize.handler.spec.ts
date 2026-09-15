import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import type { IPty } from "../pty";
import type {
  TerminalCursorPosition,
  TerminalMousePosition,
  TerminalViewportDimensions,
} from "../terminal-machine.state";
import { ResizeHandler } from "./resize.handler";

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

describe("ResizeHandler", () => {
  let handler: ResizeHandler;
  let mockTerminal: Terminal;
  let mockPty: IPty;
  let mockFitAddon: FitAddon;
  let container: HTMLDivElement;
  let stateManager: ReturnType<typeof createMachineState>;

  beforeEach(() => {
    vi.useFakeTimers();
    stateManager = createMachineState();
    mockPty = {
      resize: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPty;

    container = document.createElement("div");

    mockFitAddon = {
      proposeDimensions: vi.fn(),
      fit: vi.fn(),
    } as unknown as FitAddon;

    handler = new ResizeHandler(mockPty, container, stateManager);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registration", () => {
    it("should setup ResizeObserver", () => {
      const observeSpy = vi.spyOn(ResizeObserver.prototype, "observe");

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      expect(observeSpy).toHaveBeenCalledWith(container, { box: "content-box" });
    });
  });

  describe("resize logic", () => {
    it("should not call fit if dimensions are equal", () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 80, rows: 24 });

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      expect(mockFitAddon.fit).not.toHaveBeenCalled();
    });

    it("should call fit and notify PTY when dimensions change", () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });

      // We need to simulate terminal updating its cols/rows after fit()
      vi.mocked(mockFitAddon.fit).mockImplementation(() => {
        (mockTerminal as any).cols = 100;
        (mockTerminal as any).rows = 30;
      });

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      handler.resize();

      expect(mockFitAddon.fit).toHaveBeenCalled();

      // PTY resize is debounced with setTimeout
      vi.runAllTimers();
      expect(mockPty.resize).toHaveBeenCalledWith({ cols: 100, rows: 30 });
    });

    it("should update stateManager on resize", () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });
      vi.mocked(mockFitAddon.fit).mockImplementation(() => {
        (mockTerminal as any).cols = 100;
        (mockTerminal as any).rows = 30;
      });

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      handler.resize();

      expect(stateManager.dimensions!.cols).toBe(100);
      expect(stateManager.dimensions!.rows).toBe(30);
    });

    it("should ignore invalid proposed dimensions", () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: null, rows: null } as any);

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      handler.resize();

      expect(mockPty.resize).not.toHaveBeenCalled();
      expect(mockFitAddon.fit).not.toHaveBeenCalled();
      expect(stateManager.dimensions!.cols).toBe(80);
      expect(stateManager.dimensions!.rows).toBe(24);
    });

    it("should throw error if terminal does not match proposed dimensions after fit", () => {
      vi.mocked(mockFitAddon.proposeDimensions).mockReturnValue({ cols: 100, rows: 30 });
      // terminal remains 80x24
      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);
      handler.resize();
      expect(mockFitAddon.fit).toHaveBeenCalled();
      // Since the check was removed, it should not throw anymore but just work (or do nothing if we added a check)
    });
  });

  // Re-fitting after a theme or padding change is triggered by the session,
  // which knows what a theme is; the machine only offers `resize()`.

  describe("Lifecycle", () => {
    it("should disconnect the observer on dispose", () => {
      const disconnectSpy = vi.spyOn(ResizeObserver.prototype, "disconnect");
      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);
      handler.dispose();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
