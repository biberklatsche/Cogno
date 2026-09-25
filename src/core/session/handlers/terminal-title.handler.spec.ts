import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import type { OsType } from "@cogno/platform/os";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

import { TerminalTitleHandler } from "./terminal-title.handler";

/** The handler a spec expects to be registered; fails loudly if it is not. */
function handlerOf<T>(handler: T | undefined): T {
  if (!handler) throw new Error("Handler was not registered.");
  return handler;
}

describe("TerminalTitleHandler", () => {
  let handler: TerminalTitleHandler;
  let mockTerminal: Terminal;
  let facts: SessionFact[];

  beforeEach(() => {
    const model = createModel("test-terminal-id");
    facts = [];
    model.facts$.subscribe((fact) => facts.push(fact));
    handler = new TerminalTitleHandler(model);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  function oscHandlerFor(code: number) {
    return handlerOf(
      vi
        .mocked(mockTerminal.parser.registerOscHandler)
        .mock.calls.find((call) => call[0] === code)?.[1],
    );
  }

  it("registers OSC handlers for 0 and 2", () => {
    handler.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(0, expect.any(Function));
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(2, expect.any(Function));
  });

  it("states the new title when OSC 2 is received", () => {
    handler.registerTerminal(mockTerminal);

    const result = oscHandlerFor(2)("New Title 2");

    expect(result).toBe(true);
    expect(facts).toEqual([{ type: "titleChanged", title: "New Title 2" }]);
  });

  it("states the new title when OSC 0 is received", () => {
    handler.registerTerminal(mockTerminal);

    const result = oscHandlerFor(0)("New Title 0");

    expect(result).toBe(true);
    expect(facts).toEqual([{ type: "titleChanged", title: "New Title 0" }]);
  });

  it("states a cleared title when a program hands the title back", () => {
    handler.registerTerminal(mockTerminal);

    oscHandlerFor(2)("");
    oscHandlerFor(0)("   ");

    expect(facts).toEqual([
      { type: "titleChanged", title: undefined },
      { type: "titleChanged", title: undefined },
    ]);
  });

  it("disposes both OSC handlers and survives dispose before register", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
    expect(() => handler.dispose()).not.toThrow();

    handler.registerTerminal(mockTerminal);
    handler.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(2);
  });
});
