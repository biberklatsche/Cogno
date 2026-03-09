import { describe, expect, it, vi } from "vitest";
import { FilesystemContract, QueryContext } from "@cogno/core-sdk";
import { CommandSpecRegistry } from "./spec/command-spec.registry";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";
import { SpecCommandSuggestor } from "./spec-command.suggestor";
import { CommandSpec } from "./spec/spec.types";
import { createCommandSpecsFixture } from "./spec/testing/command-specs.fixture";

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
    const defaults = createCommandSpecsFixture();
    const filesystem = (): FilesystemContract => ({
        normalizePath: (path) => path,
        resolvePath: (cwd, input) => `${cwd.replace(/\/$/, "")}/${input}`,
        list: vi.fn(),
        exists: vi.fn(),
        readTextFile: vi.fn(),
        toDisplayPath: (path) => path,
        toRelativePath: (path) => path,
    });

    it("suggests command names in command mode", async () => {
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
        const result = await suggestor.suggest(commandContext("np"));
        expect(result.some(v => v.label === "npm")).toBe(true);
    });

    it("includes top-level command description from spec metadata", async () => {
        const railsSpec: CommandSpec = {
            name: "rails",
            source: "fig",
            sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/rails.ts",
            description: "Ruby on Rails CLI",
        };
        const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, railsSpec]), []);

        const result = await suggestor.suggest(commandContext("ra"));
        expect(result.find(v => v.label === "rails")?.description).toBe("Ruby on Rails CLI");
    });

    it("suggests npm scripts via provider for npm run", async () => {
        const fs = filesystem();
        vi.mocked(fs.exists).mockResolvedValue(true);
        vi.mocked(fs.readTextFile).mockResolvedValue(JSON.stringify({
            scripts: {
                test: "vitest",
                build: "ng build",
            },
        }));

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            [new NpmScriptsSpecProvider(fs)]
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
        const fs = filesystem();
        vi.mocked(fs.exists).mockResolvedValue(true);
        vi.mocked(fs.readTextFile).mockResolvedValue(JSON.stringify({
            scripts: {
                test: "vitest",
            },
        }));

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            [new NpmScriptsSpecProvider(fs)]
        );
        const result = await suggestor.suggest(commandContext("npm "));
        expect(result.some(v => v.source === "npm-script")).toBe(false);
    });

    it("suggests secondary options for subcommand and hides already-typed token", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            []
        );
        const result = await suggestor.suggest(commandContext("git commit "));

        expect(result.some(v => v.label === "commit")).toBe(false);
        expect(result.some(v => v.label === "-a")).toBe(true);
        expect(result.some(v => v.label === "-m")).toBe(true);
    });

    it("suggests subcommands even with leading whitespace", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            []
        );
        const result = await suggestor.suggest(commandContext("  git "));
        expect(result.some(v => v.label === "commit")).toBe(true);
    });

    it("does not suggest subcommands for exact command token without trailing space", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            []
        );
        const result = await suggestor.suggest(commandContext("git"));
        expect(result.some(v => v.label === "commit")).toBe(false);
        expect(result.some(v => v.label === "git")).toBe(true);
    });

    it("does not suggest npm subcommands for exact command token without trailing space", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            []
        );
        const result = await suggestor.suggest(commandContext("npm"));
        expect(result.some(v => v.label === "run")).toBe(false);
        expect(result.some(v => v.label === "npm")).toBe(true);
    });

    it("shows PowerShell-only specs only in PowerShell", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
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
                {
                    name: "deploy",
                    args: { name: "target" },
                },
            ],
            options: [
                { name: ["--bind", "-b"], description: "Bind working directory" },
                { name: "--env", description: "Set env var", args: { name: "env" } },
            ],
        };

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry([...defaults, actSpec]),
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

        const resultNeedsUserInput = await suggestor.suggest(commandContext("act deploy "));
        expect(resultNeedsUserInput.some(v => v.label === "--bind")).toBe(true);
        expect(resultNeedsUserInput.some(v => v.label === "--env")).toBe(true);
    });

    it("supports provider bindings on subcommands and blocks free-form arg suggestions", async () => {
        const scriptsProvider = {
            id: "scripts-provider",
            suggest: vi.fn().mockResolvedValue(["test", "build"]),
        };

        const npmLike: CommandSpec = {
            name: "xpm",
            subcommands: [
                {
                    name: "run",
                    args: { name: "script" },
                    providers: [{ providerId: "scripts-provider", source: "xpm-script", baseScore: 60 }],
                },
            ],
            options: [
                { name: "-m", args: { name: "message" } },
            ],
        };

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry([...defaults, npmLike]),
            [scriptsProvider as any]
        );

        const scripts = await suggestor.suggest(commandContext("xpm run "));
        expect(scripts.map(v => v.label)).toContain("test");
        expect(scripts.map(v => v.label)).toContain("build");

        const noneAfterMessage = await suggestor.suggest(commandContext("xpm -m "));
        expect(noneAfterMessage).toEqual([]);
    });

    it("supports options defined directly on subcommands", async () => {
        const spec: CommandSpec = {
            name: "toolx",
            subcommands: [
                {
                    name: "deploy",
                    options: [
                        { name: ["--env", "-e"], args: { name: "env" } },
                        { name: "--force" },
                    ],
                },
            ],
        };

        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry([...defaults, spec]),
            []
        );

        const result = await suggestor.suggest(commandContext("toolx deploy --"));
        const labels = result.map(v => v.label);
        expect(labels).toContain("--env");
        expect(labels).toContain("--force");
    });

    it("suggests subcommand options after subcommand with positional args", async () => {
        const suggestor = new SpecCommandSuggestor(
            new CommandSpecRegistry(defaults),
            []
        );

        const result = await suggestor.suggest(commandContext("git commit "));
        const labels = result.map(v => v.label);
        expect(labels).toContain("-a");
        expect(labels).toContain("-m");
    });
});
