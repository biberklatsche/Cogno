import { describe, expect, it, vi } from "vitest";

import { Fs } from "../../../../../_tauri/fs";
import { CommandSpecRegistry, DEFAULT_COMMAND_SPECS } from "../spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "../spec/providers/npm-scripts.spec-provider";
import { QueryContext } from "../autocomplete.types";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { SpecCommandRanker } from "../spec/ranking/binary-availability.ranker";

function commandContext(beforeCursor: string): QueryContext {
    return {
        mode: "command",
        beforeCursor,
        inputText: beforeCursor,
        cursorIndex: beforeCursor.length,
        replaceStart: 0,
        replaceEnd: beforeCursor.length,
        cwd: "/Users/larswolfram/projects",
        shellContext: { shellType: "Bash", backendOs: "macos" } as any,
        query: beforeCursor.trim(),
    };
}

describe("SpecCommandSuggestor", () => {
    it("suggests command names in command mode", async () => {
        const ranker: SpecCommandRanker = { boostForCommand: vi.fn().mockResolvedValue(0) };
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(DEFAULT_COMMAND_SPECS), [], ranker);
        const result = await suggestor.suggest(commandContext("np"));
        expect(result.some(v => v.label === "npm")).toBe(true);
    });

    it("suggests npm scripts via provider for npm run", async () => {
        vi.spyOn(Fs, "exists").mockResolvedValue(true);
        vi.spyOn(Fs, "readTextFile").mockResolvedValue(JSON.stringify({
            scripts: {
                test: "vitest",
                build: "ng build",
            },
        }));

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            [new NpmScriptsSpecProvider()],
            { boostForCommand: vi.fn().mockResolvedValue(0) }
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
        expect(result.some(v => v.label === "test")).toBe(true);
        expect(result.some(v => v.label === "build")).toBe(true);
    });

    it("does not suggest npm scripts for plain npm", async () => {
        vi.spyOn(Fs, "exists").mockResolvedValue(true);
        vi.spyOn(Fs, "readTextFile").mockResolvedValue(JSON.stringify({
            scripts: {
                test: "vitest",
            },
        }));

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            [new NpmScriptsSpecProvider()],
            { boostForCommand: vi.fn().mockResolvedValue(0) }
        );
        const result = await suggestor.suggest(commandContext("npm "));
        expect(result.some(v => v.source === "npm-script")).toBe(false);
    });

    it("applies availability rank boost without errors", async () => {
        const ranker: SpecCommandRanker = {
            boostForCommand: vi.fn().mockResolvedValue(25),
        };
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(DEFAULT_COMMAND_SPECS), [], ranker);
        const result = await suggestor.suggest(commandContext("git"));
        expect(result[0].score).toBeGreaterThan(0);
        expect((ranker.boostForCommand as any).mock.calls.length).toBeGreaterThan(0);
    });

    it("suggests secondary options for subcommand and hides already-typed token", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            [],
            { boostForCommand: vi.fn().mockResolvedValue(0) }
        );
        const result = await suggestor.suggest(commandContext("git commit "));

        expect(result.some(v => v.label === "commit")).toBe(false);
        expect(result.some(v => v.label === "-a")).toBe(true);
        expect(result.some(v => v.label === "-m")).toBe(true);
    });
});
