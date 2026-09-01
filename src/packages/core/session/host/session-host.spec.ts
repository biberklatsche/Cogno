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
    register = vi.fn().mockReturnValue({ dispose: vi.fn() });
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
    host.initializeTerminal(element);

    expect(lastRenderer().open).toHaveBeenCalledWith(element, false);
    expect(lastRenderer().register).toHaveBeenCalledTimes(16);
  });

  it("adds the observer and the editor when the shell integration is on", () => {
    const host = createHost();
    host.initialize("terminal-1", { ...bashProfile, enable_shell_integration: true });
    host.initializeTerminal(document.createElement("div"));

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
    host.initializeTerminal(document.createElement("div"));
    const pty = vi.mocked(host as unknown as { pty: { write: ReturnType<typeof vi.fn> } }).pty;

    host.insertPaths(["C:\\temp\\plain.txt", "C:\\temp\\with space.txt"]);

    expect(pty.write).toHaveBeenCalledWith("/c/temp/plain.txt '/c/temp/with space.txt'");
  });

  it("states focus changes and clears the badge when the terminal takes the keyboard", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);
    host.initializeTerminal(document.createElement("div"));
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

  it("disposes the machine exactly once", () => {
    const host = createHost();
    host.initialize("terminal-1", bashProfile);

    host.dispose();
    host.dispose();

    expect(lastRenderer().dispose).toHaveBeenCalledTimes(1);
  });
});
