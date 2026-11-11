import type { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { Opener } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { OsPlatform, type OsType } from "@cogno/platform/os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../__test__/mocks/terminal-mock.factory";
import { TerminalCommandHistoryStore } from "../model/command-history.store";
import { SessionModel } from "../model/session-model";
import { CommandRecorder } from "../recorder/command-recorder";

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

import { LinkHandler } from "./link.handler";

const osFor = (platform: OsType) => ({ platform: () => platform }) as OsPlatform;

const clipboardStub = {
  writeText: vi.fn(async () => undefined),
  readText: vi.fn(async () => ""),
  readImageFromClipboard: vi.fn(async () => null),
} as unknown as ClipboardAccess;

describe("LinkHandler", () => {
  let handler: LinkHandler;
  let stateManager: SessionModel;
  let terminal: ReturnType<typeof TerminalMockFactory.createTerminal>;
  let provider: any;
  let opener: Opener;
  let openUrlSpy: ReturnType<typeof vi.fn>;
  let openPathSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openUrlSpy = vi.fn().mockResolvedValue(undefined);
    openPathSpy = vi.fn().mockResolvedValue(undefined);
    opener = { openUrl: openUrlSpy, openPath: openPathSpy } as unknown as Opener;
    vi.mocked(clipboardStub.writeText).mockResolvedValue(undefined);
  });

  function createScenario(shellType: ShellType, backendOs: OsType, cwd: string): void {
    const os = osFor(backendOs);
    stateManager = createModel("term-1", backendOs, shellType);
    stateManager.updateCwd(cwd);
    terminal = TerminalMockFactory.createTerminal();
    handler = new LinkHandler(clipboardStub, stateManager, opener, os);
    handler.registerTerminal(terminal);
    provider = vi.mocked(terminal.registerLinkProvider).mock.calls[0]?.[0];
  }

  it("opens web links only on ctrl+click on Windows", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Docs: https://example.com/docs.");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);

    links?.[0].activate(new MouseEvent("click"), links?.[0].text);
    expect(openUrlSpy).not.toHaveBeenCalled();

    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);
    expect(openUrlSpy).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("opens web links only on cmd+click on macOS", () => {
    createScenario("ZSH", "macos", "/Users/lars/work");
    const line = TerminalMockFactory.createLine("Docs: https://example.com/docs.");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);

    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);
    expect(openUrlSpy).not.toHaveBeenCalled();

    links?.[0].activate(new MouseEvent("click", { metaKey: true }), links?.[0].text);
    expect(openUrlSpy).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("opens absolute paths via opener on ctrl+click", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Open C:\\temp\\file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith("C:\\temp\\file.txt");
  });

  it("resolves relative paths against cwd for PowerShell on Windows", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Open ./sub/file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith("C:\\work\\sub\\file.txt");
  });

  it("resolves bare relative paths against cwd for PowerShell on Windows", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Open src/core/session/exec/path.factory.spec.ts");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith(
      "C:\\work\\src\\core\\session\\exec\\path.factory.spec.ts",
    );
  });

  it("resolves relative paths against cwd for Bash on Linux", () => {
    createScenario("Bash", "linux", "/home/lars/work");
    const line = TerminalMockFactory.createLine("Open ./sub/file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith("/home/lars/work/sub/file.txt");
  });

  it("resolves absolute paths for Zsh on macOS via cmd+click", () => {
    createScenario("ZSH", "macos", "/Users/lars/work");
    const line = TerminalMockFactory.createLine("Open /Users/lars/project/file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { metaKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith("/Users/lars/project/file.txt");
  });

  it("resolves POSIX-style Windows paths with spaces on Windows", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine(
      "/C:/_dev/projects/Business Data Migration/src/frontend/packages/api/src/pipeline/hooks.ts",
    );
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith(
      "C:\\_dev\\projects\\Business Data Migration\\src\\frontend\\packages\\api\\src\\pipeline\\hooks.ts",
    );
  });

  it("shows hover hint for ctrl+click on Windows links", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Open C:\\temp\\file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].hover?.(new MouseEvent("mousemove"), links?.[0].text);
    expect(terminal.element?.getAttribute("title")).toBe("Click to copy · Ctrl+Click to open");

    links?.[0].leave?.(new MouseEvent("mouseleave"), links?.[0].text);
    expect(terminal.element?.hasAttribute("title")).toBe(false);
  });

  it("shows hover hint for cmd+click on macOS links", () => {
    createScenario("ZSH", "macos", "/Users/lars/work");
    const line = TerminalMockFactory.createLine("Open /Users/lars/project/file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].hover?.(new MouseEvent("mousemove"), links?.[0].text);
    expect(terminal.element?.getAttribute("title")).toBe("Click to copy · Cmd+Click to open");

    links?.[0].leave?.(new MouseEvent("mouseleave"), links?.[0].text);
    expect(terminal.element?.hasAttribute("title")).toBe(false);
  });

  function provideLinks(bufferLineNumber: number): any[] | undefined {
    let links: any[] | undefined;
    provider.provideLinks(bufferLineNumber, (result: any[] | undefined) => {
      links = result;
    });
    return links;
  }

  /** Screen rows of one line the terminal wrapped: every row after the first is a continuation. */
  function mockWrappedLine(...rows: string[]): void {
    const lines = rows.map((row, index) => {
      const line = TerminalMockFactory.createLine(row);
      (line as { isWrapped: boolean }).isWrapped = index > 0;
      return line;
    });
    vi.mocked(terminal.buffer.active.getLine).mockImplementation((row: number) => lines[row]);
  }

  describe("quoted paths", () => {
    it("links a quoted path with spaces without its quotes", () => {
      createScenario("PowerShell", "windows", "C:\\work");
      const text = 'Open "C:\\_dev\\My Folder\\file.txt" now';
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(
        TerminalMockFactory.createLine(text),
      );

      const links = provideLinks(1);

      expect(links).toHaveLength(1);
      expect(links?.[0].text).toBe("C:\\_dev\\My Folder\\file.txt");
      expect(links?.[0].range).toEqual({
        start: { x: text.indexOf("C:") + 1, y: 1 },
        end: { x: text.indexOf('" now'), y: 1 },
      });
      links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);
      expect(openPathSpy).toHaveBeenCalledWith("C:\\_dev\\My Folder\\file.txt");
    });

    it("links a single-quoted relative path with spaces", () => {
      createScenario("Bash", "linux", "/home/lars");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(
        TerminalMockFactory.createLine("wrote './build output/app.log'"),
      );

      const links = provideLinks(1);

      expect(links?.map((link) => link.text)).toEqual(["./build output/app.log"]);
    });

    it("does not link quoted prose", () => {
      createScenario("Bash", "linux", "/home/lars");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(
        TerminalMockFactory.createLine('error: "file not found" while reading'),
      );

      expect(provideLinks(1)).toBeUndefined();
    });

    it("links only the path inside quoted prose", () => {
      createScenario("Bash", "linux", "/home/lars");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(
        TerminalMockFactory.createLine('hint: "see /tmp/log.txt for details"'),
      );

      expect(provideLinks(1)?.map((link) => link.text)).toEqual(["/tmp/log.txt"]);
    });

    it("does not take apostrophes for quotes", () => {
      createScenario("Bash", "linux", "/home/lars");
      vi.mocked(terminal.buffer.active.getLine).mockReturnValue(
        TerminalMockFactory.createLine("don't touch /etc/hosts, it isn't yours"),
      );

      expect(provideLinks(1)?.map((link) => link.text)).toEqual(["/etc/hosts"]);
    });
  });

  describe("wrapped lines", () => {
    it("links a path that runs across two screen rows, from either row", () => {
      createScenario("Bash", "linux", "/home/lars");
      mockWrappedLine("see /home/lars/proj", "ect/src/main.ts for more");

      for (const bufferLineNumber of [1, 2]) {
        const links = provideLinks(bufferLineNumber);

        expect(links).toHaveLength(1);
        expect(links?.[0].text).toBe("/home/lars/project/src/main.ts");
        expect(links?.[0].range).toEqual({
          start: { x: 5, y: 1 },
          end: { x: "ect/src/main.ts".length, y: 2 },
        });
      }
    });

    it("keeps a space that falls on the wrap point", () => {
      createScenario("PowerShell", "windows", "C:\\work");
      mockWrappedLine('"C:\\_dev\\My ', 'Folder\\file.txt"');

      const links = provideLinks(2);

      expect(links?.map((link) => link.text)).toEqual(["C:\\_dev\\My Folder\\file.txt"]);
    });

    it("starts a link at the first column of a continuation row", () => {
      createScenario("Bash", "linux", "/home/lars");
      mockWrappedLine("open ", "/tmp/a.txt");

      const links = provideLinks(2);

      expect(links?.[0].range).toEqual({
        start: { x: 1, y: 2 },
        end: { x: "/tmp/a.txt".length, y: 2 },
      });
    });

    it("does not join rows of different lines", () => {
      createScenario("Bash", "linux", "/home/lars");
      const first = TerminalMockFactory.createLine("see /home/lars/proj");
      const second = TerminalMockFactory.createLine("ect/src/main.ts");
      vi.mocked(terminal.buffer.active.getLine).mockImplementation(
        (row: number) => [first, second][row],
      );

      expect(provideLinks(1)?.map((link) => link.text)).toEqual(["/home/lars/proj"]);
    });
  });
});
