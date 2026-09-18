import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { MachineState } from "@cogno/core/terminal/machine-state";
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

import { TerminalNotificationHandler } from "./terminal-notification.handler";

describe("TerminalNotificationHandler", () => {
  let handler: TerminalNotificationHandler;
  let mockTerminal: Terminal;
  let machine: MachineState;
  let facts: SessionFact[];

  function oscHandler(): (data: string) => boolean | Promise<boolean> {
    handler.registerTerminal(mockTerminal);
    const registered = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === 9)?.[1];
    if (!registered) throw new Error("No OSC 9 handler registered.");
    return registered;
  }

  beforeEach(() => {
    const model = createModel("test-terminal-id");
    facts = [];
    model.facts$.subscribe((fact) => facts.push(fact));
    machine = new MachineState();
    vi.spyOn(machine, "setProgress");
    handler = new TerminalNotificationHandler(model, machine);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it("registers OSC handler for 9", () => {
    handler.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(9, expect.any(Function));
  });

  it("states a notification request when OSC 9 carries a message", () => {
    const result = oscHandler()("Build completed successfully");

    expect(result).toBe(true);
    expect(facts).toEqual([
      { type: "notificationRequested", message: "Build completed successfully" },
    ]);
  });

  it("ignores empty OSC 9 payloads", () => {
    const result = oscHandler()("   \n\r   ");

    expect(result).toBe(true);
    expect(facts).toEqual([]);
  });

  it("updates terminal progress for OSC 9;4 progress payloads", () => {
    const result = oscHandler()("4;1;42");

    expect(result).toBe(true);
    expect(machine.setProgress).toHaveBeenCalledWith("default", 42);
    expect(facts).toEqual([]);
  });

  it("hides terminal progress for OSC 9;4 reset payloads", () => {
    const result = oscHandler()("4;0;0");

    expect(result).toBe(true);
    expect(machine.setProgress).toHaveBeenCalledWith("hidden", 0);
  });

  it("disposes registered handlers", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
    handler.registerTerminal(mockTerminal);

    handler.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
