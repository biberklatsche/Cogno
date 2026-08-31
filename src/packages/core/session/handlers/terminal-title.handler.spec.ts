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

  it("registers an OSC handler for 2", () => {
    handler.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(2, expect.any(Function));
  });

  it("states the new title when OSC 2 is received", () => {
    handler.registerTerminal(mockTerminal);
    const oscHandler = handlerOf(
      vi
        .mocked(mockTerminal.parser.registerOscHandler)
        .mock.calls.find((call) => call[0] === 2)?.[1],
    );

    const result = oscHandler("New Title 2");

    expect(result).toBe(true);
    expect(facts).toEqual([{ type: "titleChanged", oscCode: 2, title: "New Title 2" }]);
  });

  it("disposes the registered OSC handler and survives dispose before register", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
    expect(() => handler.dispose()).not.toThrow();

    handler.registerTerminal(mockTerminal);
    handler.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
