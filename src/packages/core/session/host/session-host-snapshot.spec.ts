import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform } from "@cogno/platform/os";
import type { IBufferCell } from "@xterm/xterm";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import type { CommandRecorder } from "../recorder/command-recorder";
import { SessionHost } from "./session-host";
import { SESSION_SNAPSHOT_VERSION } from "./session-snapshot";

interface CellOptions {
  invisible?: boolean;
  fg?: number;
}

function makeCell(char: string, o: CellOptions = {}): IBufferCell {
  return {
    getChars: () => char,
    getWidth: () => (char.length > 0 ? 1 : 0),
    isBold: () => 0,
    isDim: () => 0,
    isItalic: () => 0,
    isUnderline: () => 0,
    isBlink: () => 0,
    isInverse: () => 0,
    isInvisible: () => (o.invisible ? 1 : 0),
    isStrikethrough: () => 0,
    isOverline: () => 0,
    isFgDefault: () => o.fg === undefined,
    isBgDefault: () => true,
    isFgRGB: () => false,
    isBgRGB: () => false,
    getFgColor: () => o.fg ?? -1,
    getBgColor: () => -1,
  } as unknown as IBufferCell;
}

function makeLine(text: string, o: CellOptions = {}) {
  const cells = [...text].map((char) => makeCell(char, o));
  return {
    length: cells.length,
    getCell: (index: number) => cells[index],
    translateToString: () => text,
  };
}

let bufferLines: ReturnType<typeof makeLine>[] = [];
const writeMock = vi.fn((_data: string, callback?: () => void) => callback?.());
const terminalMock = {
  write: writeMock,
  rows: 24,
  buffer: {
    active: {
      get length() {
        return bufferLines.length;
      },
      getLine: (index: number) => bufferLines[index],
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

  it("captures SGR scrollback, keeps concealed markers, and offsets their ids", () => {
    bufferLines = [
      makeLine("error", { fg: 1 }),
      makeLine("^^#5", { invisible: true }),
      makeLine("second"),
    ];

    const snapshot = host.snapshot(500);

    expect(snapshot.version).toBe(SESSION_SNAPSHOT_VERSION);
    // Colour preserved, and the marker id shifted past the live-id range.
    expect(snapshot.scrollback).toBe(
      "\x1b[0;31merror\r\n\x1b[0;8m^^#1000000000000005\r\n\x1b[0msecond\x1b[0m",
    );
    expect(snapshot.commands).toEqual([]);
  });

  it("captures no scrollback and no commands when maxLines is zero", () => {
    bufferLines = [makeLine("something")];

    const snapshot = host.snapshot(0);

    expect(snapshot.scrollback).toBeNull();
    expect(snapshot.commands).toEqual([]);
  });

  it("returns null scrollback for an empty buffer", () => {
    bufferLines = [makeLine(""), makeLine("  ")];

    expect(host.snapshot(500).scrollback).toBeNull();
  });

  it("stashes the snapshot instead of writing it immediately", () => {
    host.restore({
      version: SESSION_SNAPSHOT_VERSION,
      scrollback: "PREVIOUS-OUTPUT",
      commands: [],
    });

    // The replay is deferred to the first attach; restore() only stashes.
    expect(writeMock).not.toHaveBeenCalled();
  });

  it("replays scrollback and separator, then a single trailing line off Windows", () => {
    host.restore({
      version: SESSION_SNAPSHOT_VERSION,
      scrollback: "PREVIOUS-OUTPUT",
      commands: [],
    });
    (host as unknown as { completeRestore(): void }).completeRestore();

    expect(writeMock).toHaveBeenCalledWith("PREVIOUS-OUTPUT");
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining("restored session"));
    // Unix ptys append, so no viewport fill - just one newline carrying the callback.
    expect(writeMock).toHaveBeenCalledWith("\r\n", expect.any(Function));
  });

  it("fills the viewport with blank lines on Windows so ConPTY paints below", () => {
    const windowsConfig = new ConfigServiceMock();
    windowsConfig.setConfig({ font: { enable_ligatures: false } } as never);
    const windowsHost = new SessionHost(
      { platform: () => "windows" } as unknown as OsPlatform,
      { isDevMode: () => false } as never,
      { writeText: vi.fn(async () => undefined) } as unknown as ClipboardAccess,
      windowsConfig as unknown as ConfigService,
      {} as never,
      { openAtElement: vi.fn() },
      {} as never,
      new TerminalCommandHistoryStore(),
      { initialize: vi.fn(), onCwdChanged: vi.fn(), onCommandExecuted: vi.fn() } as never,
    );
    windowsHost.initialize("t2", bashProfile);
    windowsHost.restore({
      version: SESSION_SNAPSHOT_VERSION,
      scrollback: "PREVIOUS-OUTPUT",
      commands: [],
    });
    (windowsHost as unknown as { completeRestore(): void }).completeRestore();

    // terminalMock.rows === 24 → a full screen of blank lines carries the callback.
    expect(writeMock).toHaveBeenCalledWith("\r\n".repeat(24), expect.any(Function));
  });

  it("does not stash a snapshot of a different version or without scrollback", () => {
    host.restore({ version: 2, scrollback: "old plain text", commands: [] });
    host.restore({ version: SESSION_SNAPSHOT_VERSION, scrollback: null, commands: [] });
    (host as unknown as { completeRestore(): void }).completeRestore();

    expect(writeMock).not.toHaveBeenCalled();
  });
});
