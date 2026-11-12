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

  function oscHandler(code = 9): (data: string) => boolean | Promise<boolean> {
    handler.registerTerminal(mockTerminal);
    const registered = vi
      .mocked(mockTerminal.parser.registerOscHandler)
      .mock.calls.find((call) => call[0] === code)?.[1];
    if (!registered) throw new Error(`No OSC ${code} handler registered.`);
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

  it.each([
    ["9;C:\\Users\\lars", "working directory"],
    ['9;"C:\\Users\\lars"', "quoted working directory"],
    ["1;500", "sleep"],
    ["3;my tab", "tab title"],
    ["12", "prompt start"],
    ["4;9;50", "progress with an unknown state"],
  ])("consumes the ConEmu sub-command %s (%s) without a notification", (payload) => {
    const result = oscHandler()(payload);

    expect(result).toBe(true);
    expect(facts).toEqual([]);
  });

  it("still takes a message that merely starts with a number", () => {
    oscHandler()("42 tests passed");
    oscHandler()("13;not a ConEmu command");
    // A ConEmu command that takes an argument, without one.
    oscHandler()("3");

    expect(facts).toEqual([
      { type: "notificationRequested", message: "42 tests passed" },
      { type: "notificationRequested", message: "13;not a ConEmu command" },
      { type: "notificationRequested", message: "3" },
    ]);
  });

  it("states a notification request with its title for OSC 777 notify", () => {
    const result = oscHandler(777)("notify;Build;done; 3 warnings");

    expect(result).toBe(true);
    expect(facts).toEqual([
      { type: "notificationRequested", message: "done; 3 warnings", title: "Build" },
    ]);
  });

  it("takes an OSC 777 notify without a body as the message", () => {
    oscHandler(777)("notify;Build done");

    expect(facts).toEqual([{ type: "notificationRequested", message: "Build done" }]);
  });

  it("ignores other OSC 777 commands", () => {
    const result = oscHandler(777)("precmd");

    expect(result).toBe(true);
    expect(facts).toEqual([]);
  });

  it("disposes registered handlers", () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });
    handler.registerTerminal(mockTerminal);

    handler.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(2);
  });
});
