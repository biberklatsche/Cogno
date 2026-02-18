import { describe, expect, it, vi } from "vitest";

import { Fs } from "../../../../../_tauri/fs";
import { CommandSpecRegistry, DEFAULT_COMMAND_SPECS } from "../spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "../spec/providers/npm-scripts.spec-provider";
import { QueryContext } from "../autocomplete.types";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { CommandSpec } from "../spec/spec.types";

function commandContext(beforeCursor: string): QueryContext {
    return commandContextWithShell(beforeCursor, "Bash");
}

function commandContextWithShell(beforeCursor: string, shellType: "Bash" | "PowerShell"): QueryContext {
    return {
        mode: "command",
        beforeCursor,
        inputText: beforeCursor,
        cursorIndex: beforeCursor.length,
        replaceStart: 0,
        replaceEnd: beforeCursor.length,
        cwd: "/Users/larswolfram/projects",
        shellContext: { shellType, backendOs: "macos" } as any,
        query: beforeCursor.trim(),
    };
}

describe("SpecCommandSuggestor", () => {
    it("suggests command names in command mode", async () => {
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(DEFAULT_COMMAND_SPECS), []);
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
            [new NpmScriptsSpecProvider()]
        );
        const result = await suggestor.suggest(commandContext("npm "));
        expect(result.some(v => v.source === "npm-script")).toBe(false);
    });

    it("suggests secondary options for subcommand and hides already-typed token", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            []
        );
        const result = await suggestor.suggest(commandContext("git commit "));

        expect(result.some(v => v.label === "commit")).toBe(false);
        expect(result.some(v => v.label === "-a")).toBe(true);
        expect(result.some(v => v.label === "-m")).toBe(true);
    });

    it("shows PowerShell-only specs only in PowerShell", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(DEFAULT_COMMAND_SPECS),
            []
        );

        const bashResult = await suggestor.suggest(commandContextWithShell("Get-", "Bash"));
        expect(bashResult.some(v => v.label === "Get-ChildItem")).toBe(false);

        const pwshResult = await suggestor.suggest(commandContextWithShell("Get-", "PowerShell"));
        expect(pwshResult.some(v => v.label === "Get-ChildItem")).toBe(true);
    });

    it("supports hierarchical fig subcommands/options with descriptions", async () => {
        const actSpec: CommandSpec = {
            name: "act",
            description: "Run GitHub actions locally",
            subcommands: [
                {
                    name: "completion",
                    description: "Generate shell completion",
                    subcommands: [
                        { name: "bash", description: "Generate for bash" },
                        { name: "zsh", description: "Generate for zsh" },
                    ],
                },
            ],
            options: [
                { name: ["--bind", "-b"], description: "Bind working directory" },
                { name: "--env", description: "Set env var", args: { name: "env" } },
            ],
        };

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry([...DEFAULT_COMMAND_SPECS, actSpec]),
            []
        );

        const resultLevel2 = await suggestor.suggest(commandContext("act completion "));
        const labels = resultLevel2.map(v => v.label);
        expect(labels).toContain("bash");
        expect(labels).toContain("zsh");
        expect(resultLevel2.find(v => v.label === "bash")?.description).toBe("Generate for bash");

        const resultOptions = await suggestor.suggest(commandContext("act --"));
        expect(resultOptions.some(v => v.label === "--bind")).toBe(true);
        expect(resultOptions.some(v => v.label === "--env")).toBe(true);
    });
});
