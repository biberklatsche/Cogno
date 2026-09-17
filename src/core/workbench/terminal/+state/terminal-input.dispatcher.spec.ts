import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import type { SessionHost } from "@cogno/core/session/host/session-host";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { EMPTY } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../../../__test__/destroy-ref";
import { TerminalInputDispatcher } from "./terminal-input.dispatcher";
import { TerminalSessionRegistry } from "./terminal-session.registry";

function hostStub() {
  return {
    facts$: EMPTY,
    focus: vi.fn(),
    blur: vi.fn(),
    setVisible: vi.fn(),
    setPaneMaximized: vi.fn(),
    clearBuffer: vi.fn(),
    writeRaw: vi.fn(),
    paste: vi.fn(async () => undefined),
    copy: vi.fn(async () => undefined),
    cut: vi.fn(),
    runEditorAction: vi.fn(),
    search: vi.fn(),
    reveal: vi.fn(),
  };
}

describe("TerminalInputDispatcher", () => {
  let bus: AppBus;
  let registry: TerminalSessionRegistry;
  let host1: ReturnType<typeof hostStub>;
  let host2: ReturnType<typeof hostStub>;

  beforeEach(() => {
    bus = new AppBus();
    registry = new TerminalSessionRegistry();
    host1 = hostStub();
    host2 = hostStub();
    registry.register("t1", {} as ShellProfile, host1 as unknown as SessionHost);
    registry.register("t2", {} as ShellProfile, host2 as unknown as SessionHost);
    new TerminalInputDispatcher(bus, registry, getDestroyRef());
  });

  it("focuses the addressed session and blurs the rest", () => {
    bus.publish({ path: ["app", "terminal"], type: "FocusTerminal", payload: "t1" });

    expect(host1.focus).toHaveBeenCalledTimes(1);
    expect(host2.blur).toHaveBeenCalledTimes(1);
    expect(host1.blur).not.toHaveBeenCalled();
  });

  it("blurs only the addressed session on BlurTerminal", () => {
    bus.publish({ path: ["app", "terminal"], type: "BlurTerminal", payload: "t1" });

    expect(host1.blur).toHaveBeenCalledTimes(1);
    expect(host2.blur).not.toHaveBeenCalled();
  });

  it("writes raw input to the addressed session", () => {
    bus.publish({
      path: ["app", "terminal"],
      type: "WriteRawToPty",
      payload: { terminalId: "t2", text: "ls\n", autoExecute: true },
    });

    expect(host2.writeRaw).toHaveBeenCalledWith("ls\n", true);
    expect(host1.writeRaw).not.toHaveBeenCalled();
  });

  it("fans VisibleTerminalsChanged out to every session", () => {
    bus.publish({
      type: "VisibleTerminalsChanged",
      payload: { terminalIds: ["t1"] },
    });

    expect(host1.setVisible).toHaveBeenCalledExactlyOnceWith(true);
    expect(host2.setVisible).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("fans PaneMaximizedChanged out to every session", () => {
    bus.publish({
      path: ["app", "grid"],
      type: "PaneMaximizedChanged",
      payload: { terminalId: "t1" },
    });

    expect(host1.setPaneMaximized).toHaveBeenCalledWith(true);
    expect(host2.setPaneMaximized).toHaveBeenCalledWith(false);
  });

  it("runs an editor action on the addressed session", () => {
    bus.publish({ path: ["app", "terminal"], type: "ClearLine", payload: "t1" });

    expect(host1.runEditorAction).toHaveBeenCalledWith("clearLine");
    expect(host2.runEditorAction).not.toHaveBeenCalled();
  });
});
