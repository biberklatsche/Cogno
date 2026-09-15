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

import { FullScreenAppHandler } from "./full-screen-app.handler";

const ENTERED: SessionFact = { type: "fullScreenChanged", active: true };
const LEFT: SessionFact = { type: "fullScreenChanged", active: false };

/** The handler a spec expects to be registered; fails loudly if it is not. */
function handlerOf<T>(handler: T | undefined): T {
  if (!handler) throw new Error("Handler was not registered.");
  return handler;
}

describe("FullScreenAppHandler", () => {
  let handler: FullScreenAppHandler;
  let mockTerminal: Terminal;
  let machine: MachineState;
  let facts: SessionFact[];

  beforeEach(() => {
    const model = createModel("test-terminal-id");
    facts = [];
    model.facts$.subscribe((fact) => facts.push(fact));
    machine = new MachineState();
    handler = new FullScreenAppHandler(model, machine);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  describe("registration", () => {
    it("should register CSI handlers", () => {
      handler.registerTerminal(mockTerminal);
      expect(mockTerminal.parser.registerCsiHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe("CSI handler logic", () => {
    beforeEach(() => {
      handler.registerTerminal(mockTerminal);
    });

    it("states fullScreenChanged(active) when Restore Window CSI sequence is received", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find((call) => (call[0] as any).final === "t")?.[1],
      );

      csiHandler([22, 0, 0]);

      expect(facts).toContainEqual(ENTERED);
      expect(machine.state.isInFullScreenMode).toBe(true);
    });

    it("states fullScreenChanged(inactive) when Save Window CSI sequence is received", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find((call) => (call[0] as any).final === "t")?.[1],
      );

      csiHandler([23, 0, 0]);

      expect(facts).toContainEqual(LEFT);
      expect(machine.state.isInFullScreenMode).toBe(false);
    });

    it("states fullScreenChanged(active) when alternate screen buffer is enabled", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "h",
          )?.[1],
      );

      csiHandler([1049]);

      expect(facts).toContainEqual(ENTERED);
      expect(machine.state.isInFullScreenMode).toBe(true);
    });

    it("states fullScreenChanged(active) when alternate screen is enabled with combined params", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "h",
          )?.[1],
      );

      csiHandler([1049, 1000, 1006]);

      expect(facts).toContainEqual(ENTERED);
      expect(machine.state.isInFullScreenMode).toBe(true);
    });

    it("states fullScreenChanged(active) when legacy alternate screen buffer is enabled", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "h",
          )?.[1],
      );

      csiHandler([1047]);

      expect(facts).toContainEqual(ENTERED);
      expect(machine.state.isInFullScreenMode).toBe(true);
    });

    it("states fullScreenChanged(inactive) when alternate screen buffer is disabled", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "l",
          )?.[1],
      );

      csiHandler([1049]);

      expect(facts).toContainEqual(LEFT);
      expect(machine.state.isInFullScreenMode).toBe(false);
    });

    it("states fullScreenChanged(inactive) when legacy alternate screen buffer is disabled", () => {
      const csiHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "l",
          )?.[1],
      );

      csiHandler([47]);

      expect(facts).toContainEqual(LEFT);
      expect(machine.state.isInFullScreenMode).toBe(false);
    });

    it("should handle helix mouse tracking sequences", () => {
      const hHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "h",
          )?.[1],
      );
      const lHandler = handlerOf(
        vi
          .mocked(mockTerminal.parser.registerCsiHandler)
          .mock.calls.find(
            (call) => (call[0] as any).prefix === "?" && (call[0] as any).final === "l",
          )?.[1],
      );

      lHandler([1003, 1006]);
      expect(facts).toEqual([ENTERED]);

      facts.length = 0;
      hHandler([1003, 1006]);
      expect(facts).toEqual([LEFT]);
    });
  });

  describe("Lifecycle", () => {
    it("should dispose all registered handlers", () => {
      const disposeSpy = vi.fn();
      vi.mocked(mockTerminal.parser.registerCsiHandler).mockReturnValue({ dispose: disposeSpy });

      handler.registerTerminal(mockTerminal);
      handler.dispose();

      expect(disposeSpy).toHaveBeenCalledTimes(3);
    });
  });
});
