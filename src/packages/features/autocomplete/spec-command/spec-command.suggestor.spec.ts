import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandRunnerContract, FilesystemContract, QueryContext } from "@cogno/core-api";
import { describe, expect, it, vi } from "vitest";
import { CommandSpecRegistry } from "./spec/command-spec.registry";
import { CommandListSpecProvider } from "./spec/providers/command-list.spec-provider";
import { FilesystemSpecProvider } from "./spec/providers/filesystem.spec-provider";
import { NpmScriptsSpecProvider } from "./spec/providers/npm-scripts.spec-provider";
import type { CommandSpec, SpecSuggestionProvider } from "./spec/spec.types";
import { createCommandSpecsFixture } from "./spec/testing/command-specs.fixture";
import { SpecCommandSuggestor } from "./spec-command.suggestor";

function commandContext(beforeCursor: string): QueryContext {
  return commandContextWithShell(beforeCursor, "Bash");
}

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

function commandContextWithShell(
  beforeCursor: string,
  shellType: "Bash" | "PowerShell",
): QueryContext {
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

function loadCommandSpec(name: string): CommandSpec {
  return JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src",
        "packages",
        "features",
        "autocomplete",
        "spec-command",
        "data",
        "commands",
        `${name}.json`,
      ),
      "utf8",
    ),
  ) as CommandSpec;
}

describe("SpecCommandSuggestor", () => {
  const defaults = createCommandSpecsFixture();
  const filesystem = (): FilesystemContract => ({
    normalizePath: vi.fn((path) => path),
    resolvePath: vi.fn((cwd, input) => `${cwd.replace(/\/$/, "")}/${input}`),
    list: vi.fn(),
    exists: vi.fn(),
    readTextFile: vi.fn(),
    toDisplayPath: vi.fn((path) => path),
    appendPathSeparator: vi.fn((path) => `${path}/`),
    toRelativePath: vi.fn((path) => path),
  });
  const commandRunner = (): CommandRunnerContract => ({
    run: vi.fn(),
  });

  it("suggests command names in command mode", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
    const result = await suggestor.suggest(commandContext("np"));
    expect(result.some((v) => v.label === "npm")).toBe(true);
  });

  it("includes top-level command description from spec metadata", async () => {
    const railsSpec: CommandSpec = {
      name: "rails",
      source: "fig",
      sourceUrl: "https://github.com/withfig/autocomplete/tree/master/src/rails.ts",
      description: "Ruby on Rails CLI",
    };
    const suggestor = new SpecCommandSuggestor(
      new CommandSpecRegistry([...defaults, railsSpec]),
      [],
    );

    const result = await suggestor.suggest(commandContext("ra"));
    expect(result.find((v) => v.label === "rails")?.description).toBe("Ruby on Rails CLI");
  });

  it("suggests npm scripts via provider for npm run", async () => {
    const fs = filesystem();
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue(
      JSON.stringify({
        scripts: {
          test: "vitest",
          build: "ng build",
        },
      }),
    );

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), [
      new NpmScriptsSpecProvider(fs),
    ]);

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
    expect(result.some((v) => v.label === "test")).toBe(true);
    expect(result.some((v) => v.label === "build")).toBe(true);
  });

  it("suggests npm scripts via provider for yarn, yarn run, and pnpm run", async () => {
    const fs = filesystem();
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue(
      JSON.stringify({
        scripts: {
          test: "vitest",
          build: "ng build",
        },
      }),
    );

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), [
      new NpmScriptsSpecProvider(fs),
    ]);

    const yarnShortcutResult = await suggestor.suggest(commandContext("yarn "));
    expect(yarnShortcutResult.some((v) => v.label === "test")).toBe(true);
    expect(yarnShortcutResult.some((v) => v.label === "build")).toBe(true);

    const yarnResult = await suggestor.suggest(commandContext("yarn run "));
    expect(yarnResult.some((v) => v.label === "test")).toBe(true);
    expect(yarnResult.some((v) => v.label === "build")).toBe(true);

    const pnpmResult = await suggestor.suggest(commandContext("pnpm run "));
    expect(pnpmResult.some((v) => v.label === "test")).toBe(true);
    expect(pnpmResult.some((v) => v.label === "build")).toBe(true);
  });

  it("suggests directory entries for cd via filesystem provider", async () => {
    const fs = filesystem();
    vi.mocked(fs.list).mockResolvedValue([
      { name: "Projects", path: "/Users/larswolfram/projects/Projects", kind: "directory" },
      { name: "Private", path: "/Users/larswolfram/projects/Private", kind: "directory" },
      { name: "notes.txt", path: "/Users/larswolfram/projects/notes.txt", kind: "file" },
    ]);
    vi.mocked(fs.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

    const cdSpec: CommandSpec = {
      name: "cd",
      providers: [
        {
          providerId: "filesystem",
          source: "fs-dir",
          params: {
            kinds: ["directory"],
            appendSlashToDirectories: true,
          },
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, cdSpec]), [
      new FilesystemSpecProvider(fs),
    ]);

    const result = await suggestor.suggest(cdContext("Pr"));
    expect(result.some((v) => v.label === "Projects/")).toBe(true);
    expect(result.some((v) => v.label === "Private/")).toBe(true);
    expect(result.some((v) => v.label === "notes.txt")).toBe(false);
  });

  it("replaces the full cd path fragment after escaped spaces when continuing directory suggestions", async () => {
    const fs = filesystem();
    vi.mocked(fs.list).mockResolvedValue([
      {
        name: "test",
        path: "/Users/larswolfram/projects/projects/Neuer Ordner/test",
        kind: "directory",
      },
    ]);
    vi.mocked(fs.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));
    vi.mocked(fs.appendPathSeparator).mockImplementation((path) => `${path}/`);

    const cdSpec: CommandSpec = {
      name: "cd",
      providers: [
        {
          providerId: "filesystem",
          source: "fs-dir",
          params: {
            kinds: ["directory"],
            appendSlashToDirectories: true,
            continueSuggestions: true,
          },
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, cdSpec]), [
      new FilesystemSpecProvider(fs),
    ]);

    const result = await suggestor.suggest(cdContext("projects/Neuer\\ Ordner/te"));

    expect(result).toHaveLength(1);
    expect(result[0].insertText).toBe("projects/Neuer\\ Ordner/test/");
    expect(result[0].replaceStart).toBe(3);
    expect(result[0].replaceEnd).toBe("cd projects/Neuer\\ Ordner/te".length);
  });

  it("suggests file entries for cat via filesystem provider", async () => {
    const fs = filesystem();
    vi.mocked(fs.list).mockResolvedValue([
      { name: "notes.txt", path: "/Users/larswolfram/projects/notes.txt", kind: "file" },
      { name: "package.json", path: "/Users/larswolfram/projects/package.json", kind: "file" },
      { name: "Projects", path: "/Users/larswolfram/projects/Projects", kind: "directory" },
    ]);
    vi.mocked(fs.toDisplayPath).mockImplementation((path, cwd) => path.replace(`${cwd}/`, ""));

    const catSpec: CommandSpec = {
      name: "cat",
      providers: [
        {
          providerId: "filesystem",
          source: "fs-file",
          params: {
            kinds: ["file"],
          },
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, catSpec]), [
      new FilesystemSpecProvider(fs),
    ]);

    const result = await suggestor.suggest(commandContext("cat pa"));
    expect(result.some((v) => v.label === "package.json")).toBe(true);
    expect(result.some((v) => v.label === "Projects")).toBe(false);
  });

  it("suggests git branches via provider for checkout", async () => {
    const runner = commandRunner();
    vi.mocked(runner.run).mockResolvedValue({
      stdout: "main\nfeature/search\n",
      stderr: "",
      exitCode: 0,
    });

    const gitSpec: CommandSpec = {
      name: "git",
      subcommands: [
        {
          name: "checkout",
          args: [{ name: "branch" }, { name: "pathspec" }],
          providers: [
            {
              providerId: "command-list",
              source: "git-branch",
              baseScore: 62,
              params: {
                program: "git",
                args: [
                  "for-each-ref",
                  "--sort=-HEAD",
                  "--sort=refname",
                  "--format=%(refname:short)",
                  "refs/heads",
                  "refs/remotes",
                ],
                itemLabel: "git branch",
              },
              when: {
                argsRegex: "^\\s*checkout(?:\\s+(?!-)\\S*)?$",
              },
            },
          ],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, gitSpec]), [
      new CommandListSpecProvider(runner),
    ]);

    const result = await suggestor.suggest(commandContext("git checkout fe"));
    expect(result.some((v) => v.label === "feature/search")).toBe(true);
    expect(result.some((v) => v.label === "main")).toBe(false);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("reports command provider failures without rejecting the spec suggestor", async () => {
    const runner = commandRunner();
    vi.mocked(runner.run).mockResolvedValue({
      stdout: "",
      stderr: "program not found",
      exitCode: 1,
    });
    const reportAutocompleteProviderIssue = vi.fn();

    const gitSpec: CommandSpec = {
      name: "git",
      subcommands: [
        {
          name: "checkout",
          args: [{ name: "branch" }],
          providers: [
            {
              providerId: "command-list",
              source: "git-branch",
              params: {
                program: "git",
                args: ["for-each-ref", "refs/heads"],
                itemLabel: "git branch",
              },
            },
          ],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(
      new CommandSpecRegistry([...defaults, gitSpec]),
      [new CommandListSpecProvider(runner)],
      { reportAutocompleteProviderIssue },
    );

    const result = await suggestor.suggest(commandContext("git checkout fe"));

    expect(result).toEqual([]);
    expect(reportAutocompleteProviderIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "error",
        providerId: "command-list",
        suggestorId: "spec-command",
        command: "git",
        message: expect.stringContaining("program not found"),
      }),
    );
    expect(reportAutocompleteProviderIssue.mock.calls[0][0].message).toContain(
      'Command provider "git for-each-ref refs/heads" failed',
    );
  });

  it("uses configured provider timeout for spec providers without notifying", async () => {
    vi.useFakeTimers();
    try {
      const reportAutocompleteProviderIssue = vi.fn();
      const slowProvider: SpecSuggestionProvider = {
        id: "slow-provider",
        suggest: vi.fn(() => new Promise(() => undefined)),
      };
      const spec: CommandSpec = {
        name: "tool",
        subcommands: [
          {
            name: "select",
            args: { name: "item" },
            providers: [{ providerId: "slow-provider" }],
          },
        ],
      };
      const suggestor = new SpecCommandSuggestor(
        new CommandSpecRegistry([...defaults, spec]),
        [slowProvider],
        { reportAutocompleteProviderIssue },
        () => 25,
      );

      const pending = suggestor.suggest(commandContext("tool select a"));
      await vi.advanceTimersByTimeAsync(30);
      const result = await pending;

      expect(result).toEqual([]);
      expect(reportAutocompleteProviderIssue).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("suggests git branches only after the remote argument for push", async () => {
    const runner = commandRunner();
    vi.mocked(runner.run).mockResolvedValue({
      stdout: "main\nrelease/1.0\n",
      stderr: "",
      exitCode: 0,
    });

    const gitSpec: CommandSpec = {
      name: "git",
      subcommands: [
        {
          name: "push",
          args: [{ name: "remote" }, { name: "branch" }],
          providers: [
            {
              providerId: "command-list",
              source: "git-branch",
              baseScore: 62,
              params: {
                program: "git",
                args: [
                  "for-each-ref",
                  "--sort=-HEAD",
                  "--sort=refname",
                  "--format=%(refname:short)",
                  "refs/heads",
                  "refs/remotes",
                ],
                itemLabel: "git branch",
              },
              when: {
                argsRegex: "^\\s*push\\s+\\S+\\s+(?!-)(?:\\S*)$",
              },
            },
          ],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, gitSpec]), [
      new CommandListSpecProvider(runner),
    ]);

    expect(await suggestor.suggest(commandContext("git push or"))).toEqual([]);

    const result = await suggestor.suggest(commandContext("git push origin re"));
    expect(result.some((v) => v.label === "release/1.0")).toBe(true);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("suggests git branches for switch create start-point, but not for the new branch name", async () => {
    const runner = commandRunner();
    vi.mocked(runner.run).mockResolvedValue({
      stdout: "main\nrelease/1.0\n",
      stderr: "",
      exitCode: 0,
    });

    const gitSpec: CommandSpec = {
      name: "git",
      subcommands: [
        {
          name: "switch",
          options: [
            {
              name: ["-c", "--create"],
              args: [{ name: "new branch" }, { name: "start point" }],
              providers: [
                {
                  providerId: "command-list",
                  source: "git-branch",
                  baseScore: 62,
                  params: {
                    program: "git",
                    args: [
                      "for-each-ref",
                      "--sort=-HEAD",
                      "--sort=refname",
                      "--format=%(refname:short)",
                      "refs/heads",
                      "refs/remotes",
                    ],
                    itemLabel: "git branch",
                  },
                  when: {
                    argsRegex: "^\\s*switch\\s+(?:-c|--create)\\s+\\S+\\s+(?!-)(?:\\S*)$",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, gitSpec]), [
      new CommandListSpecProvider(runner),
    ]);

    expect(await suggestor.suggest(commandContext("git switch -c ne"))).toEqual([]);

    const result = await suggestor.suggest(commandContext("git switch -c new-branch re"));
    expect(result.some((v) => v.label === "release/1.0")).toBe(true);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("does not suggest npm scripts for plain npm", async () => {
    const fs = filesystem();
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue(
      JSON.stringify({
        scripts: {
          test: "vitest",
        },
      }),
    );

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), [
      new NpmScriptsSpecProvider(fs),
    ]);
    const result = await suggestor.suggest(commandContext("npm "));
    expect(result.some((v) => v.source === "npm-script")).toBe(false);
  });

  it("suggests secondary options for subcommand and hides already-typed token", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
    const result = await suggestor.suggest(commandContext("git commit "));

    expect(result.some((v) => v.label === "commit")).toBe(false);
    expect(result.some((v) => v.label === "-a")).toBe(true);
    expect(result.some((v) => v.label === "-m")).toBe(true);
  });

  it("suggests subcommands even with leading whitespace", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
    const result = await suggestor.suggest(commandContext("  git "));
    expect(result.some((v) => v.label === "commit")).toBe(true);
  });

  it("does not suggest subcommands for exact command token without trailing space", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
    const result = await suggestor.suggest(commandContext("git"));
    expect(result.some((v) => v.label === "commit")).toBe(false);
    expect(result.some((v) => v.label === "git")).toBe(true);
  });

  it("does not suggest npm subcommands for exact command token without trailing space", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);
    const result = await suggestor.suggest(commandContext("npm"));
    expect(result.some((v) => v.label === "run")).toBe(false);
    expect(result.some((v) => v.label === "npm")).toBe(true);
  });

  it("shows PowerShell-only specs only in PowerShell", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);

    const bashResult = await suggestor.suggest(commandContextWithShell("Get-", "Bash"));
    expect(bashResult.some((v) => v.label === "Get-ChildItem")).toBe(false);

    const pwshResult = await suggestor.suggest(commandContextWithShell("Get-", "PowerShell"));
    expect(pwshResult.some((v) => v.label === "Get-ChildItem")).toBe(true);
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

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, actSpec]), []);

    const resultLevel2 = await suggestor.suggest(commandContext("act completion "));
    const labels = resultLevel2.map((v) => v.label);
    expect(labels).toContain("bash");
    expect(labels).toContain("zsh");
    expect(resultLevel2.find((v) => v.label === "bash")?.description).toBe("Generate for bash");

    const resultOptions = await suggestor.suggest(commandContext("act --"));
    expect(resultOptions.some((v) => v.label === "--bind")).toBe(true);
    expect(resultOptions.some((v) => v.label === "--env")).toBe(true);

    const resultNeedsUserInput = await suggestor.suggest(commandContext("act deploy "));
    expect(resultNeedsUserInput.some((v) => v.label === "--bind")).toBe(true);
    expect(resultNeedsUserInput.some((v) => v.label === "--env")).toBe(true);
  });

  it("supports provider bindings on subcommands and blocks free-form arg suggestions", async () => {
    const fs = filesystem();
    vi.mocked(fs.exists).mockResolvedValue(true);
    vi.mocked(fs.readTextFile).mockResolvedValue(
      JSON.stringify({
        scripts: {
          test: "vitest",
          build: "vite build",
        },
      }),
    );

    const npmLike: CommandSpec = {
      name: "xpm",
      subcommands: [
        {
          name: "run",
          args: { name: "script" },
          providers: [{ providerId: "npm-scripts", source: "xpm-script", baseScore: 60 }],
        },
      ],
      options: [{ name: "-m", args: { name: "message" } }],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, npmLike]), [
      new NpmScriptsSpecProvider(fs),
    ]);

    const scripts = await suggestor.suggest(commandContext("xpm run "));
    expect(scripts.map((v) => v.label)).toContain("test");
    expect(scripts.map((v) => v.label)).toContain("build");

    const noneAfterMessage = await suggestor.suggest(commandContext("xpm -m "));
    expect(noneAfterMessage).toEqual([]);
  });

  it("supports options defined directly on subcommands", async () => {
    const spec: CommandSpec = {
      name: "toolx",
      subcommands: [
        {
          name: "deploy",
          options: [{ name: ["--env", "-e"], args: { name: "env" } }, { name: "--force" }],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, spec]), []);

    const result = await suggestor.suggest(commandContext("toolx deploy --"));
    const labels = result.map((v) => v.label);
    expect(labels).toContain("--env");
    expect(labels).toContain("--force");
  });

  it("prefers a backend-specific provider over the default provider with the same id", async () => {
    const defaultProvider: SpecSuggestionProvider = {
      id: "command-list",
      suggest: vi.fn().mockResolvedValue([{ label: "default-item" }]),
    };
    const windowsProvider: SpecSuggestionProvider = {
      id: "command-list",
      suggest: vi.fn().mockResolvedValue([{ label: "windows-item" }]),
    };

    const spec: CommandSpec = {
      name: "git",
      subcommands: [
        {
          name: "remote",
          subcommands: [
            {
              name: "show",
              args: [{ name: "remote" }],
              providers: [
                {
                  providerId: "command-list",
                  source: "git-remote",
                  params: {
                    program: "git",
                    args: ["remote"],
                    itemLabel: "git remote",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([...defaults, spec]), [
      { provider: defaultProvider },
      { provider: windowsProvider, backendOs: ["windows"] },
    ]);

    const result = await suggestor.suggest({
      ...commandContext("git remote show "),
      shellContext: { shellType: "PowerShell", backendOs: "windows" } as any,
    });

    expect(result.some((v) => v.label === "windows-item")).toBe(true);
    expect(result.some((v) => v.label === "default-item")).toBe(false);
    expect(defaultProvider.suggest).not.toHaveBeenCalled();
    expect(windowsProvider.suggest).toHaveBeenCalledTimes(1);
  });

  it("suggests subcommand options after subcommand with positional args", async () => {
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry(defaults), []);

    const result = await suggestor.suggest(commandContext("git commit "));
    const labels = result.map((v) => v.label);
    expect(labels).toContain("-a");
    expect(labels).toContain("-m");
  });

  it("suggests current dotnet SDK subcommands and options from the imported spec", async () => {
    const dotnetSpec = loadCommandSpec("dotnet");
    const suggestor = new SpecCommandSuggestor(new CommandSpecRegistry([dotnetSpec]), []);

    const rootLabels = (await suggestor.suggest(commandContext("dotnet "))).map((v) => v.label);
    expect(rootLabels).toContain("package");
    expect(rootLabels).toContain("reference");
    expect(rootLabels).toContain("sdk");
    expect(rootLabels).toContain("workload");

    const newLabels = (await suggestor.suggest(commandContext("dotnet new "))).map((v) => v.label);
    expect(newLabels).toContain("create");
    expect(newLabels).toContain("install");
    expect(newLabels).toContain("list");

    const runLabels = (await suggestor.suggest(commandContext("dotnet run --"))).map(
      (v) => v.label,
    );
    expect(runLabels).toContain("--file");
    expect(runLabels).toContain("--artifacts-path");
    expect(runLabels).toContain("--environment");

    const watchLabels = (await suggestor.suggest(commandContext("dotnet watch "))).map(
      (v) => v.label,
    );
    expect(watchLabels).toContain("run");
    expect(watchLabels).toContain("build");
    expect(watchLabels).toContain("test");
    expect(watchLabels).not.toContain("publish");

    const watchRunLabels = (await suggestor.suggest(commandContext("dotnet watch run --"))).map(
      (v) => v.label,
    );
    expect(watchRunLabels).toContain("--file");
    expect(watchRunLabels).toContain("--project");
  });
});
