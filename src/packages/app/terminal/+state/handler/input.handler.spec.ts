import { Char } from "@cogno/core-support";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { IPty } from "../pty/pty";
import type { TerminalStateManager } from "../state";
import { InputHandler } from "./input.handler";

describe("InputHandler", () => {
  let handler: InputHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockStateManager: Pick<TerminalStateManager, "clearUnreadNotification">;
  let mockPty: Pick<IPty, "write">;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    mockBus = new AppBus();
    mockStateManager = { clearUnreadNotification: vi.fn() };
    mockPty = { write: vi.fn() };
    handler = new InputHandler(
      mockBus,
      terminalId,
      mockStateManager as TerminalStateManager,
      mockPty as IPty,
    );
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe("registration", () => {
    it("registers for bus events", () => {
      const subscribeSpy = vi.spyOn(mockBus, "on$");
      handler.registerTerminal(mockTerminal);
      expect(subscribeSpy).toHaveBeenCalled();
    });

    it("clears unread notification when terminal data is entered", () => {
      let terminalOnDataCallback: ((data: string) => void) | undefined;
      mockTerminal = TerminalMockFactory.createTerminal({
        onData: (callback) => {
          terminalOnDataCallback = callback;
          return { dispose: vi.fn() };
        },
      });

      handler.registerTerminal(mockTerminal);
      terminalOnDataCallback?.("ls");

      expect(mockStateManager.clearUnreadNotification).toHaveBeenCalled();
    });
  });

  describe("bus events", () => {
    beforeEach(() => handler.registerTerminal(mockTerminal));

    it("clears terminal on ClearBuffer event for this id", () => {
      const clearSpy = vi.spyOn(mockTerminal, "clear");
      mockBus.publish({ type: "ClearBuffer", payload: terminalId, path: ["app", "terminal"] });
      expect(clearSpy).toHaveBeenCalled();
    });

    it("does not clear terminal on ClearBuffer event for other id", () => {
      const clearSpy = vi.spyOn(mockTerminal, "clear");
      mockBus.publish({ type: "ClearBuffer", payload: "other-id", path: ["app", "terminal"] });
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it("writes injected text to pty on InjectTerminalInput", () => {
      mockBus.publish({
        type: "InjectTerminalInput",
        path: ["app", "terminal"],
        payload: { terminalId, text: "hello from ai" },
      });
      expect(mockPty.write).toHaveBeenCalledWith("hello from ai");
    });

    it("appends Enter after injected text when appendNewline is true", async () => {
      mockBus.publish({
        type: "InjectTerminalInput",
        path: ["app", "terminal"],
        payload: { terminalId, text: "run this", appendNewline: true },
      });

      expect(mockPty.write).toHaveBeenNthCalledWith(1, "run this");
      await vi.waitFor(() => {
        expect(mockPty.write).toHaveBeenNthCalledWith(2, Char.Enter);
      });
    });
  });

  describe("lifecycle", () => {
    it("stops handling events after dispose", () => {
      const clearSpy = vi.spyOn(mockTerminal, "clear");
      handler.registerTerminal(mockTerminal);
      handler.dispose();

      mockBus.publish({ type: "ClearBuffer", payload: terminalId, path: ["app", "terminal"] });
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});
