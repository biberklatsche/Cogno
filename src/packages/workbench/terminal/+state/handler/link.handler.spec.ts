import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../../../app-bus/app-bus";
import { TerminalMockFactory } from "../../../../__test__/mocks/terminal-mock.factory";
import { TerminalStateManager } from "../state";
import { LinkHandler } from "./link.handler";
import { Opener } from "../../../_tauri/opener";
import { PathFactory } from "@cogno/core-host";
import { baseFeatureShellPathAdapterDefinitions } from "@cogno/base-features";

describe("LinkHandler", () => {
    let handler: LinkHandler;
    let stateManager: TerminalStateManager;
    let terminal: ReturnType<typeof TerminalMockFactory.createTerminal>;
    let provider: any;

    beforeEach(() => {
        PathFactory.setDefinitions([
            ...baseFeatureShellPathAdapterDefinitions,
        ]);
        const bus = new AppBus();
        stateManager = new TerminalStateManager(bus);
        stateManager.initialize("term-1", "PowerShell" as any);
        stateManager.updateCwd("C:\\work");
        terminal = TerminalMockFactory.createTerminal();
        handler = new LinkHandler(stateManager);
        handler.registerTerminal(terminal);
        provider = vi.mocked(terminal.registerLinkProvider).mock.calls[0]?.[0];
    });

    it("opens web links only on ctrl+click", () => {
        const line = TerminalMockFactory.createLine("Docs: https://example.com/docs.");
        vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

        let links: any[] | undefined;
        provider.provideLinks(1, (result: any[] | undefined) => {
            links = result;
        });

        expect(links).toHaveLength(1);

        links![0].activate(new MouseEvent("click"), links![0].text);
        expect(Opener.openUrl).not.toHaveBeenCalled();

        links![0].activate(new MouseEvent("click", { ctrlKey: true }), links![0].text);
        expect(Opener.openUrl).toHaveBeenCalledWith("https://example.com/docs");
    });

    it("opens absolute paths via opener on ctrl+click", () => {
        const line = TerminalMockFactory.createLine("Open C:\\temp\\file.txt");
        vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

        let links: any[] | undefined;
        provider.provideLinks(1, (result: any[] | undefined) => {
            links = result;
        });

        expect(links).toHaveLength(1);
        links![0].activate(new MouseEvent("click", { ctrlKey: true }), links![0].text);

        expect(Opener.openPath).toHaveBeenCalledWith("/c/temp/file.txt");
    });

    it("resolves relative paths against cwd", () => {
        const line = TerminalMockFactory.createLine("Open ./sub/file.txt");
        vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

        let links: any[] | undefined;
        provider.provideLinks(1, (result: any[] | undefined) => {
            links = result;
        });

        expect(links).toHaveLength(1);
        links![0].activate(new MouseEvent("click", { ctrlKey: true }), links![0].text);

        expect(Opener.openPath).toHaveBeenCalledWith("/c/work/sub/file.txt");
    });

    it("resolves bare relative paths against cwd", () => {
        const line = TerminalMockFactory.createLine("Open src/packages/core-host/path/path.factory.spec.ts");
        vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

        let links: any[] | undefined;
        provider.provideLinks(1, (result: any[] | undefined) => {
            links = result;
        });

        expect(links).toHaveLength(1);
        links![0].activate(new MouseEvent("click", { ctrlKey: true }), links![0].text);

        expect(Opener.openPath).toHaveBeenCalledWith("/c/work/src/packages/core-host/path/path.factory.spec.ts");
    });

    it("shows hover hint for ctrl+click on links", () => {
        const line = TerminalMockFactory.createLine("Open C:\\temp\\file.txt");
        vi.mocked(terminal.buffer.active.getLine).mockReturnValue(line);

        let links: any[] | undefined;
        provider.provideLinks(1, (result: any[] | undefined) => {
            links = result;
        });

        expect(links).toHaveLength(1);
        links![0].hover?.(new MouseEvent("mousemove"), links![0].text);
        expect(terminal.element?.getAttribute("title")).toBe("Ctrl + Click to open");

        links![0].leave?.(new MouseEvent("mouseleave"), links![0].text);
        expect(terminal.element?.hasAttribute("title")).toBe(false);
    });
});
