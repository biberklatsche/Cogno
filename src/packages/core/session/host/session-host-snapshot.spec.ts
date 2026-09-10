import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import type { CommandRecorder } from "../recorder/command-recorder";
import { SessionHost } from "./session-host";
import { SESSION_SNAPSHOT_VERSION } from "./session-snapshot";

const terminalMock = TerminalMockFactory.createTerminal();
const serializeMock = vi.fn().mockReturnValue("SERIALIZED-SCROLLBACK");

vi.mock("@cogno/core/terminal/renderer", () => {
  class RendererMock {
    open = vi.fn();
    register = vi.fn().mockReturnValue({ dispose: vi.fn() });
    dispose = vi.fn();
    setVisible = vi.fn();
    setOptions = vi.fn();
    restoreCursorColor = vi.fn();
    serialize = serializeMock;
    terminal = terminalMock;
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
const bashProfile: ShellProfile = {
  shell_type: "Bash",
  inject_cogno_cli: false,
  enable_shell_integration: false,
  load_user_rc: false,
};

describe("SessionHost snapshot/restore", () => {
  let host: SessionHost;

  beforeEach(() => {
    vi.clearAllMocks();
    const configService = new ConfigServiceMock();
    configService.setConfig({ font: { enable_ligatures: false } } as never);
    host = new SessionHost(
      osStub,
      { isDevMode: () => false } as never,
      { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess,
      configService as unknown as ConfigService,
      {} as never,
      { openAtElement: vi.fn() },
      {} as never,
      new TerminalCommandHistoryStore(),
      {
        initialize: vi.fn(),
        onCwdChanged: vi.fn(),
        onCommandExecuted: vi.fn(),
      } as unknown as CommandRecorder,
    );
    host.initialize("t1", bashProfile);
  });

  it("captures the serialized scrollback up to maxLines", () => {
    const snapshot = host.snapshot(500);

    expect(serializeMock).toHaveBeenCalledWith(500);
    expect(snapshot).toEqual({
      version: SESSION_SNAPSHOT_VERSION,
      scrollback: "SERIALIZED-SCROLLBACK",
    });
  });

  it("captures no scrollback when maxLines is zero", () => {
    const snapshot = host.snapshot(0);

    expect(serializeMock).not.toHaveBeenCalled();
    expect(snapshot.scrollback).toBeNull();
  });

  it("replays the scrollback and a separator into the terminal", () => {
    host.restore({ version: SESSION_SNAPSHOT_VERSION, scrollback: "PREVIOUS-OUTPUT" });

    expect(terminalMock.write).toHaveBeenCalledWith("PREVIOUS-OUTPUT");
    expect(terminalMock.write).toHaveBeenCalledWith(expect.stringContaining("restored session"));
  });

  it("ignores a snapshot of a different version or without scrollback", () => {
    host.restore({ version: 999, scrollback: "X" });
    host.restore({ version: SESSION_SNAPSHOT_VERSION, scrollback: null });

    expect(terminalMock.write).not.toHaveBeenCalled();
  });
});
