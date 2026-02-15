import { describe, expect, it, vi } from "vitest";

import { Fs } from "../../../../../_tauri/fs";
import { CommandSpecRegistry, DEFAULT_COMMAND_SPECS } from "../spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "../spec/providers/npm-scripts.spec-provider";
import { QueryContext } from "../autocomplete.types";
import { SpecCommandSuggestor } from "./spec-command.suggestor";

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
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(DEFAULT_COMMAND_SPECS));
        const result = await suggestor.suggest(commandContext("np"));
        expect(result.some(v => v.label === "npm")).toBe(true);
    });

    it("suggests npm scripts via provider", async () => {
        vi.spyOn(Fs, "exists").mockResolvedValue(true);
        vi.spyOn(Fs, "readTextFile").mockResolvedValue(JSON.stringify({
            scripts: {
                test: "vitest",
                build: "ng build",
            },
        }));

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            [new NpmScriptsSpecProvider()]
        );

        const ctx: QueryContext = {
            mode: "npm-script",
            beforeCursor: "npm ",
            inputText: "npm ",
            cursorIndex: 4,
            replaceStart: 4,
            replaceEnd: 4,
            cwd: "/Users/larswolfram/projects",
            shellContext: { shellType: "Bash", backendOs: "macos" } as any,
            fragment: "",
        };

        const result = await suggestor.suggest(ctx);
        expect(result.some(v => v.label === "test")).toBe(true);
        expect(result.some(v => v.label === "run")).toBe(true);
    });
});

