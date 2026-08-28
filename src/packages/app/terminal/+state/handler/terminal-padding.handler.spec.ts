import type { IRenderer } from "@cogno/core/terminal/renderer";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalPaddingHandler } from "./terminal-padding.handler";

describe("TerminalPaddingHandler", () => {
  let handler: TerminalPaddingHandler;
  let rendererStub: IRenderer;
  let mockTerminal: Terminal;
  let mockBus: AppBus;
  let mockConfig: ConfigServiceMock;
  let container: HTMLDivElement;
  const terminalId = "test-terminal-id";

  beforeEach(() => {
    mockBus = new AppBus();
    mockConfig = new ConfigServiceMock();
    mockConfig.setConfig({
      scrollbar: { scrollback_lines: 1000 },
      font: { size: 12, family: "monospace", weight: "normal", weight_bold: "bold" },
      color: {
        foreground: "ffffff",
        highlight: "00ff00",
        black: "000000",
        red: "ff0000",
        green: "00ff00",
        yellow: "ffff00",
        blue: "0000ff",
        magenta: "ff00ff",
        cyan: "00ffff",
        white: "ffffff",
      },
      cursor: { width: 2, blink: true, style: "bar", color: "ffffff" },
      padding: { remove_on_full_screen_app: false },
    });
    container = document.createElement("div");
    rendererStub = { restoreCursorColor: vi.fn() } as unknown as IRenderer;
    handler = new TerminalPaddingHandler(
      terminalId,
      mockConfig as any,
      mockBus,
      container,
      rendererStub,
    );
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe("bus events", () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it("should remove padding when FullScreenAppEntered and configured", () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: true },
      });
      const publishSpy = vi.spyOn(mockBus, "publish");

      mockBus.publish({
        type: "FullScreenAppEntered",
        path: ["app", "terminal", terminalId],
        payload: terminalId,
      });

      expect(container.style.getPropertyValue("--padding-xterm")).toBe("0");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "TerminalThemePaddingRemoved" }),
      );
    });

    it("should restore padding when FullScreenAppLeaved and configured", () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: true },
      });
      container.style.setProperty("--padding-xterm", "0");
      const publishSpy = vi.spyOn(mockBus, "publish");

      mockBus.publish({
        type: "FullScreenAppLeaved",
        path: ["app", "terminal", terminalId],
        payload: terminalId,
      });

      expect(container.style.getPropertyValue("--padding-xterm")).toBe("");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "TerminalThemePaddingAdded" }),
      );
    });

    it("should not change padding if not configured", () => {
      mockConfig.setConfig({
        ...mockConfig.config,
        padding: { remove_on_full_screen_app: false },
      });

      mockBus.publish({
        type: "FullScreenAppEntered",
        path: ["app", "terminal", terminalId],
        payload: terminalId,
      });

      expect(container.style.getPropertyValue("--padding-xterm")).toBe("");
    });

    it("asks the renderer to restore the cursor colour when requested", () => {
      handler.registerTerminal(mockTerminal);

      mockBus.publish({
        type: "TerminalCursorRestoreRequested",
        path: ["app", "terminal", terminalId],
      });

      expect(rendererStub.restoreCursorColor).toHaveBeenCalled();
    });
  });

  describe("Lifecycle", () => {
    it("stops reacting once disposed", () => {
      handler.registerTerminal(mockTerminal);
      handler.dispose();

      mockBus.publish({
        type: "TerminalCursorRestoreRequested",
        path: ["app", "terminal", terminalId],
      });

      expect(rendererStub.restoreCursorColor).not.toHaveBeenCalled();
    });
  });
});
