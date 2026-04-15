import { Opener } from "@cogno/app-tauri/opener";
import { OS, type OsType } from "@cogno/app-tauri/os";
import { PathFactory } from "@cogno/core-host";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { AppBus } from "../../../app-bus/app-bus";
import type { ShellType } from "../../../config/+models/config";
import { TerminalStateManager } from "../state";
import { LinkHandler } from "./link.handler";

describe("LinkHandler", () => {
  let handler: LinkHandler;
  let stateManager: TerminalStateManager;
  let terminal: ReturnType<typeof TerminalMockFactory.createTerminal>;
  let provider: any;
  let openUrlSpy: ReturnType<typeof vi.spyOn>;
  let openPathSpy: ReturnType<typeof vi.spyOn>;
  let _osPlatformSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    PathFactory.setDefinitions([...featureShellPathAdapterDefinitions]);
    openUrlSpy = vi.spyOn(Opener, "openUrl").mockResolvedValue();
    openPathSpy = vi.spyOn(Opener, "openPath").mockResolvedValue();
  });

  function createScenario(shellType: ShellType, backendOs: OsType, cwd: string): void {
    _osPlatformSpy = vi.spyOn(OS, "platform").mockReturnValue(backendOs);
    const bus = new AppBus();
    stateManager = new TerminalStateManager(bus);
    stateManager.initialize("term-1", shellType);
    stateManager.updateCwd(cwd);
    terminal = TerminalMockFactory.createTerminal();
    handler = new LinkHandler(stateManager);
    handler.registerTerminal(terminal);
    provider = vi.mocked(terminal.registerLinkProvider).mock.calls[0]?.[0];
  }

  it("opens web links only on ctrl+click", () => {
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
    const line = TerminalMockFactory.createLine(
      "Open src/packages/core-host/path/path.factory.spec.ts",
    );
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith(
      "C:\\work\\src\\packages\\core-host\\path\\path.factory.spec.ts",
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

  it("resolves absolute paths for Zsh on macOS", () => {
    createScenario("ZSH", "macos", "/Users/lars/work");
    const line = TerminalMockFactory.createLine("Open /Users/lars/project/file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].activate(new MouseEvent("click", { ctrlKey: true }), links?.[0].text);

    expect(openPathSpy).toHaveBeenCalledWith("/Users/lars/project/file.txt");
  });

  it("shows hover hint for ctrl+click on links", () => {
    createScenario("PowerShell", "windows", "C:\\work");
    const line = TerminalMockFactory.createLine("Open C:\\temp\\file.txt");
    vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

    let links: any[] | undefined;
    provider.provideLinks(1, (result: any[] | undefined) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    links?.[0].hover?.(new MouseEvent("mousemove"), links?.[0].text);
    expect(terminal.element?.getAttribute("title")).toBe("Ctrl + Click to open");

    links?.[0].leave?.(new MouseEvent("mouseleave"), links?.[0].text);
    expect(terminal.element?.hasAttribute("title")).toBe(false);
  });
});
