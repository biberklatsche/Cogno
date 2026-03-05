import { describe, expect, it, vi, beforeEach } from "vitest";

import { Fs } from "../../../../../_tauri/fs";
import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { QueryContext } from "../autocomplete.types";
import { CommandSpecRegistry } from "../spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "../spec/providers/npm-scripts.spec-provider";
import { createCommandSpecsFixture } from "../spec/testing/command-specs.fixture";
import { FilesystemDirectorySuggestor } from "./filesystem-directory.suggestor";
import { HistoryCommandSuggestor } from "./history-command.suggestor";
import { HistoryDirectorySuggestor } from "./history-directory.suggestor";
import { SpecCommandSuggestor } from "./spec-command.suggestor";

const readDirMock = vi.fn();
vi.mock("@tauri-apps/plugin-fs", () => ({
    readDir: (...args: any[]) => readDirMock(...args),
}));

const baseHistoryRow = {
    lastSelectAt: 0,
    cwdExecCount: 0,
    cwdSelectCount: 0,
    cwdLastExecAt: 0,
    cwdLastSelectAt: 0,
};
const baseDirHistoryRow = {
    lastSelectAt: 0,
};

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
                { path: "/Users/larswolfram/projects", basename: "projects", visitCount: 10, selectCount: 1, lastVisitAt: 1, ...baseDirHistoryRow },
                { path: "/Users", basename: "Users", visitCount: 5, selectCount: 1, lastVisitAt: 1, ...baseDirHistoryRow },
                { path: "/Users/larswolfram/projects/app", basename: "app", visitCount: 5, selectCount: 1, lastVisitAt: 1, ...baseDirHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest(cdContext("u"));

        expect(result.some(r => r.label === "." || r.label === "..")).toBe(false);
        expect(result.some(r => r.label.startsWith("../"))).toBe(false);
        expect(result.some(r => r.label === "/Users")).toBe(true);
    });

    it("HistoryDirectorySuggestor matches multi-token fragments against visited paths", async () => {
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([
                { path: "/c/projects/grimace-tracker/src", basename: "src", visitCount: 10, selectCount: 2, lastVisitAt: 1, ...baseDirHistoryRow },
                { path: "/c/projects/grimace-tools", basename: "grimace-tools", visitCount: 10, selectCount: 2, lastVisitAt: 1, ...baseDirHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest(cdContext("gr tr"));

        expect(persistence.searchDirectories).toHaveBeenCalledWith("gr", 100);
        expect(result.map(r => r.detail)).toContain("/c/projects/grimace-tracker/src");
        expect(result.map(r => r.detail)).not.toContain("/c/projects/grimace-tools");
    });

    it("HistoryDirectorySuggestor ranks multi-token ba src and prefers recently selected backend/src", async () => {
        const now = Date.now();
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([
                {
                    path: "/work/backend/src",
                    basename: "src",
                    visitCount: 8,
                    selectCount: 7,
                    lastVisitAt: now - 120_000,
                    lastSelectAt: now - 30_000,
                },
                {
                    path: "/work/bar/src",
                    basename: "src",
                    visitCount: 8,
                    selectCount: 2,
                    lastVisitAt: now - (14 * 24 * 60 * 60 * 1000),
                    lastSelectAt: now - (20 * 24 * 60 * 60 * 1000),
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest(cdContext("ba src"));

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].detail).toBe("/work/backend/src");
        expect(result.map(r => r.detail)).toContain("/work/backend/src");
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
                { command: "npm test", execCount: 10, selectCount: 5, lastExecAt: 1, ...baseHistoryRow },
                { command: "npm run build", execCount: 2, selectCount: 1, lastExecAt: 1, ...baseHistoryRow },
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
    });

    it("HistoryCommandSuggestor boosts only same command token over general matches", async () => {
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "npm test", execCount: 0, selectCount: 0, lastExecAt: 1, ...baseHistoryRow },
                { command: "git npm helper", execCount: 0, selectCount: 0, lastExecAt: 1, ...baseHistoryRow },
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

        expect(result[0].label).toBe("npm test");
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it("HistoryCommandSuggestor replaces full input in npm-script mode", async () => {
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "npm test", execCount: 10, selectCount: 5, lastExecAt: 1, ...baseHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const ctx: QueryContext = {
            mode: "npm-script",
            beforeCursor: "npm te",
            inputText: "npm te",
            cursorIndex: 6,
            replaceStart: 4,
            replaceEnd: 6,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            fragment: "te",
        };
        const result = await suggestor.suggest(ctx);

        expect(result).toHaveLength(1);
        expect(result[0].replaceStart).toBe(0);
        expect(result[0].replaceEnd).toBe(6);
    });

    it("HistoryCommandSuggestor filters suggestions made only from words already in prompt", async () => {
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "npm", execCount: 10, selectCount: 5, lastExecAt: 1, ...baseHistoryRow },
                { command: "npm run", execCount: 8, selectCount: 4, lastExecAt: 1, ...baseHistoryRow },
                { command: "npm test", execCount: 6, selectCount: 3, lastExecAt: 1, ...baseHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const ctx: QueryContext = {
            mode: "command",
            beforeCursor: "npm t",
            inputText: "npm t",
            cursorIndex: 5,
            replaceStart: 0,
            replaceEnd: 5,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            query: "npm t",
        };

        const result = await suggestor.suggest(ctx);
        const labels = result.map(item => item.label);

        expect(labels).not.toContain("npm");
        expect(labels).not.toContain("npm run");
        expect(labels).toContain("npm test");
    });

    it("HistoryCommandSuggestor matches multi-token input like gi pu to git push", async () => {
        const now = Date.now();
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                {
                    command: "git push",
                    execCount: 10,
                    selectCount: 7,
                    lastExecAt: now - 60_000,
                    lastSelectAt: now - 30_000,
                    cwdExecCount: 4,
                    cwdSelectCount: 3,
                    cwdLastExecAt: now - 60_000,
                    cwdLastSelectAt: now - 30_000,
                },
                {
                    command: "git pull",
                    execCount: 20,
                    selectCount: 9,
                    lastExecAt: now - 60_000,
                    lastSelectAt: now - 30_000,
                    cwdExecCount: 5,
                    cwdSelectCount: 4,
                    cwdLastExecAt: now - 60_000,
                    cwdLastSelectAt: now - 30_000,
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const ctx: QueryContext = {
            mode: "command",
            beforeCursor: "gi pu",
            inputText: "gi pu",
            cursorIndex: 5,
            replaceStart: 0,
            replaceEnd: 5,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            query: "gi pu",
        };

        const result = await suggestor.suggest(ctx);
        expect(result[0].label).toBe("git push");
    });

    it("SpecCommandSuggestor returns npm scripts when package.json exists", async () => {
        vi.spyOn(Fs, "exists").mockResolvedValue(true);
        vi.spyOn(Fs, "readTextFile").mockResolvedValue(
            JSON.stringify({ scripts: { test: "vitest", build: "ng build" } })
        );

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(createCommandSpecsFixture()),
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
