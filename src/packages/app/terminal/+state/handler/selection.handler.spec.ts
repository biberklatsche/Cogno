import { Clipboard } from "@cogno/app-tauri/clipboard";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import {
  clear,
  getAppBus,
  getConfigService,
  getSelectionHandler,
  getStateManager,
} from "../../../../__test__/test-factory";
import type { AppBus } from "../../../app-bus/app-bus";
import type { SelectionHandler } from "./selection.handler";

vi.mock("@cogno/app-tauri/clipboard", () => ({
  Clipboard: {
    writeText: vi.fn(),
  },
}));

describe("SelectionHandler", () => {
  let handler: SelectionHandler;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockConfig: ConfigServiceMock;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    clear();
    mockBus = getAppBus();
    mockConfig = getConfigService();
    mockConfig.setConfig({
      selection: { clear_on_copy: false },
    });
    handler = getSelectionHandler(terminalId);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe("selection methods", () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it("should proxy hasSelection", () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      expect(handler.hasSelection()).toBe(true);

      vi.mocked(mockTerminal.hasSelection).mockReturnValue(false);
      expect(handler.hasSelection()).toBe(false);
    });

    it("should proxy getSelection", () => {
      vi.mocked(mockTerminal.getSelection).mockReturnValue("selected text");
      expect(handler.getSelection()).toBe("selected text");
    });

    it("should sanitize prompt markers in getSelection", () => {
      vi.mocked(mockTerminal.getSelection).mockReturnValue("selected\n^^#7\ntext");
      expect(handler.getSelection()).toBe("selected\ntext");
    });

    it("should proxy clearSelection", () => {
      handler.clearSelection();
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });

    it("should report selection changes to terminal state", () => {
      const stateManager = getStateManager();
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);

      const selectionChangeCallback = vi.mocked(mockTerminal.onSelectionChange).mock
        .calls[0]?.[0] as () => void;
      selectionChangeCallback();

      expect(stateManager.hasSelection).toBe(true);
    });
  });

  describe("bus events", () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it("should copy selection to clipboard when Copy event is received", async () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue("text to copy");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => {
        expect(Clipboard.writeText).toHaveBeenCalledWith("text to copy");
      });
    });

    it("should strip prompt markers from copied text", async () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue("line 1\n^^#12\nline 2");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => {
        expect(Clipboard.writeText).toHaveBeenCalledWith("line 1\nline 2");
      });
    });

    it("should clear selection after copy if configured", async () => {
      mockConfig.setConfig({
        selection: { clear_on_copy: true },
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue("text to copy");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      await vi.waitFor(() => {
        expect(mockTerminal.clearSelection).toHaveBeenCalled();
      });
    });

    it("should not clear selection after copy if not configured", async () => {
      mockConfig.setConfig({
        selection: { clear_on_copy: false },
      });
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      vi.mocked(mockTerminal.getSelection).mockReturnValue("text to copy");

      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockTerminal.clearSelection).not.toHaveBeenCalled();
    });

    it("should do nothing if other terminal id in Copy event", async () => {
      mockBus.publish({ type: "Copy", payload: "other-id", path: ["app", "terminal"] });
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });

    it("should do nothing if no selection exists", async () => {
      vi.mocked(mockTerminal.hasSelection).mockReturnValue(false);
      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });
      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe("Lifecycle", () => {
    it("should unsubscribe on dispose", () => {
      handler.registerTerminal(mockTerminal);
      handler.dispose();

      vi.mocked(mockTerminal.hasSelection).mockReturnValue(true);
      mockBus.publish({ type: "Copy", payload: terminalId, path: ["app", "terminal"] });

      expect(Clipboard.writeText).not.toHaveBeenCalled();
    });
  });
});
