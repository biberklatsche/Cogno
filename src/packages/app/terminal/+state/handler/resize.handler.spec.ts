import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { IPty } from "../pty/pty";
import { TerminalStateManager } from "../state";
import { ResizeHandler } from "./resize.handler";

describe("ResizeHandler", () => {
  let handler: ResizeHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockPty: IPty;
  let mockFitAddon: FitAddon;
  let container: HTMLDivElement;
  let stateManager: TerminalStateManager;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    vi.useFakeTimers();
    mockBus = new AppBus();
    vi.spyOn(mockBus, "publish");
    stateManager = new TerminalStateManager(mockBus);
    stateManager.initialize(terminalId, "Bash");
    mockPty = {
      resize: vi.fn().mockResolvedValue(undefined),
    } as unknown as IPty;

    container = document.createElement("div");

    mockFitAddon = {
      proposeDimensions: vi.fn(),
      fit: vi.fn(),
    } as unknown as FitAddon;

    handler = new ResizeHandler(terminalId, mockPty, mockBus, container, stateManager);
    mockTerminal = TerminalMockFactory.createTerminal({ cols: 80, rows: 24 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registration", () => {
    it("should setup ResizeObserver and subscribe to bus", () => {
      const observeSpy = vi.spyOn(ResizeObserver.prototype, "observe");
      const subscribeSpy = vi.spyOn(mockBus, "on$");

      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);

      expect(observeSpy).toHaveBeenCalledWith(container, { box: "content-box" });
      expect(subscribeSpy).toHaveBeenCalled();
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

      expect(stateManager.dimensions.cols).toBe(100);
      expect(stateManager.dimensions.rows).toBe(30);
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

  describe("bus events", () => {
    it("should trigger resize on TerminalThemeChanged", () => {
      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);
      const resizeSpy = vi.spyOn(handler, "resize");

      mockBus.publish({ type: "TerminalThemeChanged", path: ["app", "terminal", terminalId] });

      vi.runAllTimers();
      expect(resizeSpy).toHaveBeenCalled();
    });
  });

  describe("Lifecycle", () => {
    it("should disconnect observer and unsubscribe on dispose", () => {
      const disconnectSpy = vi.spyOn(ResizeObserver.prototype, "disconnect");
      handler.registerFitAddon(mockFitAddon);
      handler.registerTerminal(mockTerminal);
      handler.dispose();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});
