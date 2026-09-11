import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import type { CommandRecorder } from "../recorder/command-recorder";
import { SessionHost } from "./session-host";
import { SESSION_SNAPSHOT_VERSION } from "./session-snapshot";

let bufferLines: string[] = [];
const writeMock = vi.fn();
const terminalMock = {
  write: writeMock,
  buffer: {
    active: {
      get length() {
        return bufferLines.length;
      },
      getLine: (index: number) => ({ translateToString: () => bufferLines[index] ?? "" }),
    },
  },
};

vi.mock("@cogno/core/terminal/renderer", () => {
  class RendererMock {
    open = vi.fn();
    register = vi.fn().mockReturnValue({ dispose: vi.fn() });
    dispose = vi.fn();
    setVisible = vi.fn();
    setOptions = vi.fn();
    restoreCursorColor = vi.fn();
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
    bufferLines = [];
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

  it("captures plain-text scrollback, skipping markers and trailing blanks", () => {
    bufferLines = ["first line", "^^#42", "second line", "", "   "];

    const snapshot = host.snapshot(500);

    expect(snapshot).toEqual({
      version: SESSION_SNAPSHOT_VERSION,
      scrollback: "first line\r\nsecond line",
    });
  });

  it("captures no scrollback when maxLines is zero", () => {
    bufferLines = ["something"];
    expect(host.snapshot(0).scrollback).toBeNull();
  });

  it("returns null scrollback for an empty buffer", () => {
    bufferLines = ["", "  "];
    expect(host.snapshot(500).scrollback).toBeNull();
  });

  it("replays the scrollback and a separator into the terminal", () => {
    host.restore({ version: SESSION_SNAPSHOT_VERSION, scrollback: "PREVIOUS-OUTPUT" });

    expect(writeMock).toHaveBeenCalledWith("PREVIOUS-OUTPUT");
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining("restored session"));
  });

  it("ignores a snapshot of a different version or without scrollback", () => {
    host.restore({ version: 1, scrollback: "old ANSI" });
    host.restore({ version: SESSION_SNAPSHOT_VERSION, scrollback: null });

    expect(writeMock).not.toHaveBeenCalled();
  });
});
