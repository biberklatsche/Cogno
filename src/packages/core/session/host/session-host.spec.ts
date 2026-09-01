import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { Renderer } from "@cogno/core/terminal/renderer";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";
import { SessionHost } from "./session-host";

vi.mock("@cogno/core/terminal/renderer", () => {
  class RendererMock {
    open = vi.fn();
    // Handlers really register, so the pty handler spawns and the lifecycle runs.
    register = vi.fn((handler: { registerTerminal?: (terminal: unknown) => unknown }) => {
      return handler.registerTerminal?.(this.terminal) ?? { dispose: vi.fn() };
    });
    dispose = vi.fn();
    setVisible = vi.fn();
    setOptions = vi.fn();
    restoreCursorColor = vi.fn();
    terminal = TerminalMockFactory.createTerminal();
    isWebglContextLost$ = new BehaviorSubject(false);
  }
  return { Renderer: vi.fn(RendererMock) };
});

vi.mock("@cogno/core/terminal/pty", () => {
  class PtyMock {
    dispose = vi.fn();
    write = vi.fn();
    spawn = vi.fn().mockResolvedValue(undefined);
    onExit = vi.fn().mockReturnValue({ dispose: vi.fn() });
    kill = vi.fn();
    faults$ = new Subject();
  }
  return { Pty: vi.fn(PtyMock) };
});

const osStub = { platform: () => "linux" } as unknown as OsPlatform;
const environmentStub = { isDevMode: () => false } as never;
const clipboardStub = { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess;

function configStub(config: Record<string, unknown>): ConfigService {
  return {
    config,
    config$: new BehaviorSubject(config),
    getPromptSegments: () => [],
  } as unknown as ConfigService;
}

function createHost(config: Record<string, unknown> = { font: { enable_ligatures: false } }) {
  const recorder = {
    initialize: vi.fn(),
    onCwdChanged: vi.fn(),
    onCommandExecuted: vi.fn(),
  } as unknown as CommandRecorder;
  return new SessionHost(
    osStub,
    environmentStub,
    clipboardStub,
    configStub(config),
    {} as never,
    { openAtElement: vi.fn() },
    {} as never,
    new TerminalCommandHistoryStore(),
    recorder,
  );
}

function lastRenderer() {
  const results = vi.mocked(Renderer).mock.results;
  return results[results.length - 1].value;
}

const bashProfile: ShellProfile = {
  shell_type: "Bash",
  inject_cogno_cli: false,
  enable_shell_integration: false,
  load_user_rc: false,
};

describe("SessionHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives the machine values from the config, not the config", () => {
    createHost({ terminal: { webgl: true }, font: { family: "Fira Code" } });

    expect(Renderer).toHaveBeenCalledWith(
      expect.objectContaining({ webgl: true, fontFamily: "Fira Code" }),
      "linux",
    );
  });

  it("opens the terminal and registers every handler", () => {
    const host = createHost();
    const element = document.createElement("div");
    host.initialize("terminal-1", bashProfile);
    host.start();
    host.attach(element);

    // The machine opens into the host's own element, which sits in the parent.
    expect(lastRenderer().open).toHaveBeenCalledWith(expect.any(HTMLDivElement), false);
    expect(element.querySelector(".session-host")).not.toBeNull();
    expect(lastRenderer().register).toHaveBeenCalledTimes(16);
  });

  it("adds the observer and the editor when the shell integration is on", () => {
    const host = createHost();
    host.initialize("terminal-1", { ...bashProfile, enable_shell_integration: true });
    host.start();
    host.attach(document.createElement("div"));

    expect(lastRenderer().register).toHaveBeenCalledTimes(18);
  });

  it("refuses a profile without a shell type", () => {
    const host = createHost();
    expect(() =>
      host.initialize("terminal-1", { ...bashProfile, shell_type: undefined } as never),
    ).toThrow();
  });

  it("types dropped paths rendered for the shell", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();
    host.attach(document.createElement("div"));
    const pty = vi.mocked(host as unknown as { pty: { write: ReturnType<typeof vi.fn> } }).pty;

    host.insertPaths(["C:\\temp\\plain.txt", "C:\\temp\\with space.txt"]);

    expect(pty.write).toHaveBeenCalledWith("/c/temp/plain.txt '/c/temp/with space.txt'");
  });

  it("states focus changes and clears the badge when the terminal takes the keyboard", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();
    host.attach(document.createElement("div"));
    const facts: SessionFact[] = [];
    host.facts$.subscribe((fact) => facts.push(fact));
    host.model.markUnreadNotification();

    host.focus();

    expect(host.isFocused).toBe(true);
    expect(host.model.hasUnreadNotification).toBe(false);
    expect(facts).toContainEqual({ type: "focusChanged", focused: true });
  });

  it("reads both halves as one state", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.machine.setHasSelection(true);
    host.model.setPaneMaximized(true);

    expect(host.state.hasSelection).toBe(true);
    expect(host.state.isPaneMaximized).toBe(true);
    expect(host.state.terminalId).toBe("terminal-1");
  });

  it("closes exactly once", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();

    host.close();
    host.close();

    expect(lastRenderer().dispose).toHaveBeenCalledTimes(1);
    expect(host.runtime.status).toBe("closed");
  });
});

/** Lets the mocked spawn promise settle. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function ptyOf(host: SessionHost) {
  return (
    host as unknown as {
      pty: { spawn: ReturnType<typeof vi.fn>; onExit: ReturnType<typeof vi.fn> };
    }
  ).pty;
}

describe("SessionHost lifecycle (ARCHITECTURE.md 2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs allocated -> starting -> running when the shell spawns", async () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    const seen: string[] = [];
    host.runtime$.subscribe((runtime) => seen.push(runtime.status));

    host.start();
    await settle();

    expect(seen).toEqual(["allocated", "starting", "running"]);
    expect(host.display).toBe("detached");
  });

  it("is failed with the reason when the spawn fails, and running after a retry", async () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    ptyOf(host).spawn.mockRejectedValueOnce(new Error("no such shell"));
    const facts: SessionFact[] = [];
    host.facts$.subscribe((fact) => facts.push(fact));

    host.start();
    await settle();

    expect(host.runtime).toEqual({ status: "failed", reason: "no such shell" });
    expect(facts).toContainEqual({ type: "startFailed", reason: "no such shell" });

    host.retry();
    await settle();

    expect(host.runtime.status).toBe("running");
  });

  it("keeps running while detached and only moves the element on a second attach", async () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();
    await settle();
    const first = document.createElement("div");
    const second = document.createElement("div");

    host.attach(first);
    expect(host.display).toBe("attached");
    expect(first.querySelector(".session-host")).not.toBeNull();

    host.detach();
    expect(host.display).toBe("detached");
    expect(host.runtime.status).toBe("running");
    expect(first.querySelector(".session-host")).toBeNull();
    expect(lastRenderer().setVisible).toHaveBeenLastCalledWith(false);

    host.attach(second);
    expect(second.querySelector(".session-host")).not.toBeNull();
    expect(lastRenderer().open).toHaveBeenCalledTimes(1);
    expect(lastRenderer().setVisible).toHaveBeenLastCalledWith(true);
  });

  it("states exited as a fact and decides nothing itself", async () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();
    await settle();
    host.attach(document.createElement("div"));
    const facts: SessionFact[] = [];
    host.facts$.subscribe((fact) => facts.push(fact));

    const onExit = ptyOf(host).onExit.mock.calls[0][0] as (event: { exitCode: number }) => void;
    onExit({ exitCode: 3 });

    expect(host.runtime).toEqual({ status: "exited", exitCode: 3 });
    expect(facts).toContainEqual({ type: "exited", exitCode: 3 });
    expect(host.display).toBe("attached");
    expect(lastRenderer().dispose).not.toHaveBeenCalled();
  });

  it("close detaches, ends the machine and is final", async () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.start();
    await settle();
    const parent = document.createElement("div");
    host.attach(parent);
    const seen: string[] = [];
    host.runtime$.subscribe((runtime) => seen.push(runtime.status));

    host.close();
    host.close();

    expect(seen).toEqual(["running", "closing", "closed"]);
    expect(host.display).toBe("detached");
    expect(parent.querySelector(".session-host")).toBeNull();
    expect(lastRenderer().dispose).toHaveBeenCalledTimes(1);
  });
});
