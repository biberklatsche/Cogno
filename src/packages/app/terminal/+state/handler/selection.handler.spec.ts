import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { clear, getSelectionHandler, getStateManager } from "../../../../__test__/test-factory";
import type { SelectionHandler } from "./selection.handler";

describe("SelectionHandler", () => {
  let handler: SelectionHandler;
  let mockTerminal: Terminal;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    clear();
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

  describe("Lifecycle", () => {
    it("should dispose xterm selection listener on dispose", () => {
      const disposeSelection = vi.fn();
      vi.mocked(mockTerminal.onSelectionChange).mockReturnValueOnce({ dispose: disposeSelection });

      handler.registerTerminal(mockTerminal);
      handler.dispose();

      expect(disposeSelection).toHaveBeenCalled();
    });
  });
});
