import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import type { IRenderer } from "@cogno/core/terminal/renderer";
import type { OsType } from "@cogno/platform/os";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { SessionModel } from "../model/session-model";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";

function createModel(
  terminalId: string,
  backendOs: OsType = "linux",
  shellType: ShellType = "Bash",
): SessionModel {
  const recorder = {
    initialize: vi.fn(),
    onCwdChanged: vi.fn(),
    onCommandExecuted: vi.fn(),
  } as unknown as CommandRecorder;
  const model = new SessionModel(backendOs, new TerminalCommandHistoryStore(), recorder);
  model.initialize(terminalId, shellType, undefined, backendOs);
  return model;
}

import { TerminalPaddingHandler } from "./terminal-padding.handler";

describe("TerminalPaddingHandler", () => {
  let handler: TerminalPaddingHandler;
  let model: SessionModel;
  let facts: SessionFact[];
  let rendererStub: IRenderer;
  let mockTerminal: Terminal;
  let mockConfig: ConfigServiceMock;
  let container: HTMLDivElement;

  function configurePaddingRemoval(remove: boolean): void {
    mockConfig.setConfig({ ...mockConfig.config, padding: { remove_on_full_screen_app: remove } });
  }

  beforeEach(() => {
    model = createModel("test-terminal-id");
    facts = [];
    model.facts$.subscribe((fact) => facts.push(fact));
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
    handler = new TerminalPaddingHandler(model, mockConfig as any, container, rendererStub);
    mockTerminal = TerminalMockFactory.createTerminal();
    handler.registerTerminal(mockTerminal);
  });

  it("removes the padding when a full-screen app enters and that is configured", () => {
    configurePaddingRemoval(true);

    model.report({ type: "fullScreenChanged", active: true });

    expect(container.style.getPropertyValue("--padding-xterm")).toBe("0");
    expect(facts).toContainEqual({ type: "paddingChanged", removed: true });
  });

  it("restores the padding when the full-screen app leaves", () => {
    configurePaddingRemoval(true);
    container.style.setProperty("--padding-xterm", "0");

    model.report({ type: "fullScreenChanged", active: false });

    expect(container.style.getPropertyValue("--padding-xterm")).toBe("");
    expect(facts).toContainEqual({ type: "paddingChanged", removed: false });
  });

  it("leaves the padding alone when not configured", () => {
    configurePaddingRemoval(false);

    model.report({ type: "fullScreenChanged", active: true });

    expect(container.style.getPropertyValue("--padding-xterm")).toBe("");
    expect(facts.filter((fact) => fact.type === "paddingChanged")).toEqual([]);
  });

  it("asks the renderer to restore the cursor colour on every prompt", () => {
    model.report({ type: "promptReported" });

    expect(rendererStub.restoreCursorColor).toHaveBeenCalled();
  });

  it("stops reacting once disposed", () => {
    handler.dispose();

    model.report({ type: "promptReported" });

    expect(rendererStub.restoreCursorColor).not.toHaveBeenCalled();
  });
});
