import { beforeEach, describe, expect, it, vi } from "vitest";

import { PathFactory } from "@cogno/core-host";
import { ShellContextContract } from "@cogno/core-sdk";
import { featureShellPathAdapterDefinitions } from "@cogno/features";
import { TerminalHistoryPersistenceService } from "../../history/terminal-history-persistence.service";
import { QueryContext } from "../autocomplete.types";
import { HistoryCommandPatternSuggestor } from "./history-command-pattern.suggestor";
import { HistoryCommandSuggestor } from "./history-command.suggestor";
import { HistoryDirectorySuggestor } from "./history-directory.suggestor";

const shellContext: ShellContextContract = { shellType: "Bash", backendOs: "macos" };
const baseHistoryRow = {
    lastSelectAt: 0,
    cwdExecCount: 0,
    cwdSelectCount: 0,
    cwdLastExecAt: 0,
    cwdLastSelectAt: 0,
    transitionCount: 0,
    outgoingTransitionCount: 0,
    lastTransitionAt: 0,
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
        shellContext,
        fragment,
    };
}

describe("Autocomplete History Suggestors", () => {
    beforeEach(() => {
        PathFactory.setDefinitions([
            ...featureShellPathAdapterDefinitions,
        ]);
        vi.restoreAllMocks();
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
        expect(result.some(r => r.label === "/Users/")).toBe(true);
        expect(result.every(r => r.insertText.endsWith("/"))).toBe(true);
    });

    it("HistoryDirectorySuggestor uses backslashes for PowerShell directory labels", async () => {
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([
                { path: "/Users", basename: "Users", visitCount: 5, selectCount: 1, lastVisitAt: 1, ...baseDirHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest({
            ...cdContext("u"),
            shellContext: { shellType: "PowerShell", backendOs: "windows" },
            cwd: "/Users/larswolfram/projects",
        });

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("\\Users\\");
        expect(result[0].insertText).toBe("\\Users\\");
    });

    it("HistoryDirectorySuggestor escapes bash insert text for directories with spaces", async () => {
        const persistence = {
            searchDirectories: vi.fn().mockResolvedValue([
                {
                    path: "/Users/larswolfram/projects/My Folder",
                    basename: "My Folder",
                    visitCount: 5,
                    selectCount: 1,
                    lastVisitAt: 1,
                    ...baseDirHistoryRow,
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryDirectorySuggestor(persistence);
        const result = await suggestor.suggest(cdContext("My\\ Fo"));

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("My Folder/");
        expect(result[0].insertText).toBe("My\\ Folder/");
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
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("/c/projects/grimace-tracker/src/");
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
        expect(result[0].label).toBe("/work/backend/src/");
    });

    it("HistoryCommandSuggestor returns ranked command suggestions", async () => {
        const now = Date.now();
        vi.setSystemTime(now);
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "npm test", execCount: 10, selectCount: 5, lastExecAt: now - 60_000, ...baseHistoryRow },
                { command: "npm run build", execCount: 2, selectCount: 1, lastExecAt: now - 3_600_000, ...baseHistoryRow },
                { command: "npm run lint", execCount: 1, selectCount: 0, lastExecAt: now - 7_200_000, ...baseHistoryRow },
                { command: "npm outdated", execCount: 1, selectCount: 0, lastExecAt: now - 10_800_000, ...baseHistoryRow },
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
            shellContext,
            query: "npm",
        };

        const result = await suggestor.suggest(ctx);
        expect(result.length).toBe(3);
        expect(result[0].description).toBe("executed elsewhere on this computer");
        expect(result[1].description).toBe("executed elsewhere on this computer");
        expect(result.map((item) => item.label)).not.toContain("npm outdated");
    });

    it("HistoryCommandSuggestor returns recent commands for empty query", async () => {
        const now = Date.now();
        vi.setSystemTime(now);
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                { command: "git status", execCount: 8, selectCount: 3, lastExecAt: now - 30_000, ...baseHistoryRow },
                { command: "npm test", execCount: 4, selectCount: 1, lastExecAt: now - 10_000, ...baseHistoryRow },
                { command: "pnpm lint", execCount: 2, selectCount: 0, lastExecAt: now - 5_000, ...baseHistoryRow },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const ctx: QueryContext = {
            mode: "command",
            beforeCursor: "",
            inputText: "",
            cursorIndex: 0,
            replaceStart: 0,
            replaceEnd: 0,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "",
        };

        const result = await suggestor.suggest(ctx);
        expect(persistence.searchCommands).toHaveBeenCalledWith("", "/Users/larswolfram/projects", 250);
        expect(result.map((item) => item.label)).toEqual(["git status", "npm test", "pnpm lint"]);
    });

    it("HistoryCommandSuggestor marks commands from current cwd differently than commands from elsewhere", async () => {
        const now = Date.now();
        vi.setSystemTime(now);
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                {
                    ...baseHistoryRow,
                    command: "npm test",
                    execCount: 10,
                    selectCount: 5,
                    lastExecAt: now - 60_000,
                    cwdExecCount: 3,
                },
                {
                    ...baseHistoryRow,
                    command: "npm run build",
                    execCount: 2,
                    selectCount: 1,
                    lastExecAt: now - 3_600_000,
                },
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
            shellContext,
            query: "npm",
        };

        const result = await suggestor.suggest(ctx);
        expect(result[0].description).toBe("executed in current directory");
        expect(result[1].description).toBe("executed elsewhere on this computer");
    });

    it("HistoryCommandPatternSuggestor returns learned pattern suggestions", async () => {
        const persistence = {
            searchCommandPatterns: vi.fn().mockResolvedValue([
                {
                    signature: {
                        key: "stable:git|stable:commit|stable:-am|slot:0",
                        parts: [
                            { kind: "stable", value: "git" },
                            { kind: "stable", value: "commit" },
                            { kind: "stable", value: "-am" },
                            { kind: "slot", slotIndex: 0 },
                        ],
                    },
                    totalCount: 2,
                    stableTokenCount: 3,
                    nonOptionStableTokenCount: 2,
                    variableSlotCount: 1,
                    lastSeenAt: Date.now(),
                    shownCount: 0,
                    selectedCount: 0,
                    lastShownAt: undefined,
                    lastSelectedAt: undefined,
                    slotStatistics: [
                        {
                            slotIndex: 0,
                            totalCount: 2,
                            distinctValueCount: 2,
                            topValue: "fix bug",
                            topValueCount: 1,
                        },
                    ],
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandPatternSuggestor(persistence);
        const result = await suggestor.suggest({
            mode: "command",
            beforeCursor: "git comm",
            inputText: "git comm",
            cursorIndex: 8,
            replaceStart: 0,
            replaceEnd: 8,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "git comm",
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            label: "git commit -am {arg1}",
            source: "history-pattern",
            completionBehavior: "continue",
            selectedPatternSignature: "stable:git|stable:commit|stable:-am|slot:0",
        });
    });

    it("HistoryCommandPatternSuggestor rejects overly generic patterns", async () => {
        const persistence = {
            searchCommandPatterns: vi.fn().mockResolvedValue([
                {
                    signature: {
                        key: "stable:git|slot:text",
                        parts: [
                            { kind: "stable", value: "git" },
                            { kind: "slot", slotIndex: 0 },
                        ],
                    },
                    totalCount: 4,
                    stableTokenCount: 1,
                    nonOptionStableTokenCount: 1,
                    variableSlotCount: 1,
                    lastSeenAt: Date.now(),
                    shownCount: 0,
                    selectedCount: 0,
                    lastShownAt: undefined,
                    lastSelectedAt: undefined,
                    slotStatistics: [
                        {
                            slotIndex: 0,
                            totalCount: 4,
                            distinctValueCount: 4,
                            topValue: "status",
                            topValueCount: 1,
                        },
                    ],
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandPatternSuggestor(persistence);
        const result = await suggestor.suggest({
            mode: "command",
            beforeCursor: "git",
            inputText: "git",
            cursorIndex: 3,
            replaceStart: 0,
            replaceEnd: 3,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "git",
        });

        expect(result).toEqual([]);
    });

    it("HistoryCommandPatternSuggestor suppresses patterns that were shown often but never selected", async () => {
        const persistence = {
            searchCommandPatterns: vi.fn().mockResolvedValue([
                {
                    signature: {
                        key: "stable:git|stable:commit|stable:-am|slot:0",
                        parts: [
                            { kind: "stable", value: "git" },
                            { kind: "stable", value: "commit" },
                            { kind: "stable", value: "-am" },
                            { kind: "slot", slotIndex: 0 },
                        ],
                    },
                    totalCount: 5,
                    stableTokenCount: 3,
                    nonOptionStableTokenCount: 2,
                    variableSlotCount: 1,
                    lastSeenAt: Date.now(),
                    shownCount: 8,
                    selectedCount: 0,
                    lastShownAt: Date.now(),
                    lastSelectedAt: undefined,
                    slotStatistics: [
                        {
                            slotIndex: 0,
                            totalCount: 5,
                            distinctValueCount: 5,
                            topValue: "fix bug",
                            topValueCount: 1,
                        },
                    ],
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandPatternSuggestor(persistence);
        const result = await suggestor.suggest({
            mode: "command",
            beforeCursor: "git commit",
            inputText: "git commit",
            cursorIndex: 10,
            replaceStart: 0,
            replaceEnd: 10,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "git commit",
        });

        expect(result).toEqual([]);
    });

    it("HistoryCommandPatternSuggestor ages out stale unselected patterns", async () => {
        const now = Date.now();
        const persistence = {
            searchCommandPatterns: vi.fn().mockResolvedValue([
                {
                    signature: {
                        key: "stable:git|stable:commit|stable:-am|slot:0",
                        parts: [
                            { kind: "stable", value: "git" },
                            { kind: "stable", value: "commit" },
                            { kind: "stable", value: "-am" },
                            { kind: "slot", slotIndex: 0 },
                        ],
                    },
                    totalCount: 5,
                    stableTokenCount: 3,
                    nonOptionStableTokenCount: 2,
                    variableSlotCount: 1,
                    lastSeenAt: now - (90 * 24 * 60 * 60 * 1000),
                    shownCount: 1,
                    selectedCount: 0,
                    lastShownAt: now - (60 * 24 * 60 * 60 * 1000),
                    lastSelectedAt: undefined,
                    slotStatistics: [
                        {
                            slotIndex: 0,
                            totalCount: 5,
                            distinctValueCount: 5,
                            topValue: "fix bug",
                            topValueCount: 1,
                        },
                    ],
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandPatternSuggestor(persistence);
        const result = await suggestor.suggest({
            mode: "command",
            beforeCursor: "git commit",
            inputText: "git commit",
            cursorIndex: 10,
            replaceStart: 0,
            replaceEnd: 10,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "git commit",
        });

        expect(result).toEqual([]);
    });

    it("HistoryCommandPatternSuggestor keeps selected patterns visible despite age", async () => {
        const now = Date.now();
        const persistence = {
            searchCommandPatterns: vi.fn().mockResolvedValue([
                {
                    signature: {
                        key: "stable:git|stable:commit|stable:-am|slot:0",
                        parts: [
                            { kind: "stable", value: "git" },
                            { kind: "stable", value: "commit" },
                            { kind: "stable", value: "-am" },
                            { kind: "slot", slotIndex: 0 },
                        ],
                    },
                    totalCount: 8,
                    stableTokenCount: 3,
                    nonOptionStableTokenCount: 2,
                    variableSlotCount: 1,
                    lastSeenAt: now - (30 * 24 * 60 * 60 * 1000),
                    shownCount: 12,
                    selectedCount: 4,
                    lastShownAt: now - (3 * 24 * 60 * 60 * 1000),
                    lastSelectedAt: now - (2 * 24 * 60 * 60 * 1000),
                    slotStatistics: [
                        {
                            slotIndex: 0,
                            totalCount: 8,
                            distinctValueCount: 8,
                            topValue: "fix bug",
                            topValueCount: 1,
                        },
                    ],
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandPatternSuggestor(persistence);
        const result = await suggestor.suggest({
            mode: "command",
            beforeCursor: "git commit",
            inputText: "git commit",
            cursorIndex: 10,
            replaceStart: 0,
            replaceEnd: 10,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "git commit",
        });

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("git commit -am {arg1}");
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
            shellContext,
            query: "npm",
        };

        const result = await suggestor.suggest(ctx);
        expect(result[0].label).toBe("npm test");
        expect(result[0].score).toBeGreaterThan(result[1].score);
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
            shellContext,
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
            shellContext,
            query: "gi pu",
        };

        const result = await suggestor.suggest(ctx);
        expect(result[0].label).toBe("git push");
    });

    it("HistoryCommandSuggestor boosts strong previous-to-next transitions", async () => {
        const now = Date.now();
        const persistence = {
            searchCommands: vi.fn().mockResolvedValue([
                {
                    command: "docker compose build",
                    execCount: 6,
                    selectCount: 3,
                    lastExecAt: now - 60_000,
                    lastSelectAt: now - 30_000,
                    cwdExecCount: 2,
                    cwdSelectCount: 1,
                    cwdLastExecAt: now - 60_000,
                    cwdLastSelectAt: now - 30_000,
                    transitionCount: 9,
                    outgoingTransitionCount: 12,
                    lastTransitionAt: now - 15_000,
                },
                {
                    command: "docker compose up",
                    execCount: 12,
                    selectCount: 7,
                    lastExecAt: now - 60_000,
                    lastSelectAt: now - 30_000,
                    cwdExecCount: 4,
                    cwdSelectCount: 2,
                    cwdLastExecAt: now - 60_000,
                    cwdLastSelectAt: now - 30_000,
                    transitionCount: 1,
                    outgoingTransitionCount: 12,
                    lastTransitionAt: now - (14 * 24 * 60 * 60 * 1000),
                },
            ]),
        } as unknown as TerminalHistoryPersistenceService;

        const suggestor = new HistoryCommandSuggestor(persistence);
        const context: QueryContext = {
            mode: "command",
            beforeCursor: "docker compose",
            inputText: "docker compose",
            cursorIndex: 14,
            replaceStart: 0,
            replaceEnd: 14,
            cwd: "/Users/larswolfram/projects",
            shellContext,
            query: "docker compose",
        };

        const result = await suggestor.suggest(context);
        expect(result[0].label).toBe("docker compose build");
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });
});
