import { describe, expect, it, vi, beforeEach } from "vitest";

import { Fs } from "../../../../../_tauri/fs";
import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { QueryContext } from "../autocomplete.types";
import { CommandSpecRegistry, DEFAULT_COMMAND_SPECS } from "../spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "../spec/providers/npm-scripts.spec-provider";
import { FilesystemDirectorySuggestor } from "./filesystem-directory.suggestor";
import { HistoryCommandSuggestor } from "./history-command.suggestor";
import { HistoryDirectorySuggestor } from "./history-directory.suggestor";
import { SpecCommandSuggestor } from "./spec-command.suggestor";

const readDirMock = vi.fn();
vi.mock("@tauri-apps/plugin-fs", () => ({
    readDir: (...args: any[]) => readDirMock(...args),
}));

function cdContext(fragment: string): QueryContext {
    return {
        mode: "cd",
        beforeCursor: `cd ${fragment}`,
        inputText: `cd ${fragment}`,
        cursorIndex: 3 + fragment.length,
        replaceStart: 3,
        replaceEnd: 3 + fragment.length,
        cwd: "/Users/larswolfram/projects",
        shellContext: { shellType: "Bash", backendOs: "macos" } as any,
        fragment,
    };
}

describe("Autocomplete Suggestors", () => {
    beforeEach(() => {
        readDirMock.mockReset();
    });

    it("HistoryDirectorySuggestor filters current dir and parent traversal suggestions", async () => {
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([
                { path: "/Users/larswolfram/projects", basename: "projects", visitCount: 10, selectCount: 1, lastVisitAt: 1 },
                { path: "/Users", basename: "Users", visitCount: 5, selectCount: 1, lastVisitAt: 1 },
                { path: "/Users/larswolfram/projects/app", basename: "app", visitCount: 5, selectCount: 1, lastVisitAt: 1 },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest(cdContext("u"));

        expect(result.some(r => r.label === "." || r.label === "..")).toBe(false);
        expect(result.some(r => r.label.startsWith("../"))).toBe(false);
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("FilesystemDirectorySuggestor returns directory matches and excludes parent traversals", async () => {
        readDirMock.mockResolvedValue([
            { name: "Users", isDirectory: true, isFile: false, isSymlink: false },
            { name: "tmp", isDirectory: true, isFile: false, isSymlink: false },
            { name: "notes.txt", isDirectory: false, isFile: true, isSymlink: false },
        ]);

        const suggestor = new FilesystemDirectorySuggestor();
        const result = await suggestor.suggest(cdContext("u"));

        expect(result.some(r => r.label.toLowerCase().includes("users"))).toBe(true);
        expect(result.some(r => r.label.startsWith("../"))).toBe(false);
    });

    it("FilesystemDirectorySuggestor resolves absolute root fragments", async () => {
        readDirMock.mockResolvedValue([
            { name: "Users", isDirectory: true, isFile: false, isSymlink: false },
            { name: "tmp", isDirectory: true, isFile: false, isSymlink: false },
        ]);

        const suggestor = new FilesystemDirectorySuggestor();
        const result = await suggestor.suggest(cdContext("/"));

        expect(readDirMock).toHaveBeenCalledWith("/");
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("FilesystemDirectorySuggestor reuses cached dir results and narrows by prefix", async () => {
        readDirMock.mockResolvedValue([
            { name: "Projects", isDirectory: true, isFile: false, isSymlink: false },
            { name: "Private", isDirectory: true, isFile: false, isSymlink: false },
            { name: "tmp", isDirectory: true, isFile: false, isSymlink: false },
        ]);

        const suggestor = new FilesystemDirectorySuggestor();
        const first = await suggestor.suggest(cdContext("p"));
        const second = await suggestor.suggest(cdContext("pr"));

        expect(readDirMock).toHaveBeenCalledTimes(1);
        expect(first.some(r => r.label.toLowerCase().includes("projects"))).toBe(true);
        expect(second.every(r => r.label.toLowerCase().includes("pr"))).toBe(true);
    });

    it("HistoryCommandSuggestor returns ranked command suggestions", async () => {
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "npm test", execCount: 10, selectCount: 5, lastExecAt: 1 },
                { command: "npm run build", execCount: 2, selectCount: 1, lastExecAt: 1 },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const ctx: QueryContext = {
            mode: "command",
            beforeCursor: "npm",
            inputText: "npm",
            cursorIndex: 3,
            replaceStart: 0,
            replaceEnd: 3,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            query: "npm",
        };
        const result = await suggestor.suggest(ctx);

        expect(result.length).toBe(2);
        expect(result[0].kind).toBe("command");
    });

    it("SpecCommandSuggestor returns npm scripts when package.json exists", async () => {
        vi.spyOn(Fs, "exists").mockResolvedValue(true);
        vi.spyOn(Fs, "readTextFile").mockResolvedValue(
            JSON.stringify({ scripts: { test: "vitest", build: "ng build" } })
        );

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            [new NpmScriptsSpecProvider()]
        );
        const ctx: QueryContext = {
            mode: "command",
            beforeCursor: "npm run ",
            inputText: "npm run ",
            cursorIndex: 8,
            replaceStart: 8,
            replaceEnd: 8,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            query: "npm run",
        };

        const result = await suggestor.suggest(ctx);
        expect(result.some(r => r.label === "test")).toBe(true);
        expect(result.some(r => r.label === "build")).toBe(true);
    });
});
