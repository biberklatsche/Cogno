import type { CommandRunnerContract, QueryContext } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandListSpecProvider } from "./command-list.spec-provider";

function commandContext(beforeCursor: string): QueryContext {
  return {
    mode: "command",
    beforeCursor,
    inputText: beforeCursor,
    cursorIndex: beforeCursor.length,
    replaceStart: 0,
    replaceEnd: beforeCursor.length,
    cwd: "/Users/larswolfram/projects/repo",
    shellContext: { shellType: "Bash", backendOs: "macos" } as any,
    query: beforeCursor.trim(),
  };
}

describe("CommandListSpecProvider", () => {
  let commandRunner: CommandRunnerContract;

  beforeEach(() => {
    commandRunner = {
      run: vi.fn(),
    };
  });

  it("returns command-backed suggestions and filters by query", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: "main\nfeature/search\nrelease/1.0\n",
      stderr: "",
      exitCode: 0,
    });

    const provider = new CommandListSpecProvider(commandRunner);
    const result = await provider.suggest({
      queryContext: commandContext("git checkout re"),
      command: "git",
      args: ["checkout", "re"],
      binding: {
        providerId: "command-list",
        params: {
          program: "git",
          args: ["tag", "--list"],
          itemLabel: "git tag",
        },
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith({
      cwd: "/Users/larswolfram/projects/repo",
      shellContext: expect.anything(),
      program: "git",
      args: ["tag", "--list"],
    });
    expect(result.map((item) => item.label)).toEqual(["release/1.0", "feature/search"]);
    expect(result[0]?.description).toBe("git tag");
  });

  it("maps tabular output using configured fields", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: "web\tnginx:latest\tUp 2 hours\napi\tmy-api:dev\tExited (0)\n",
      stderr: "",
      exitCode: 0,
    });

    const provider = new CommandListSpecProvider(commandRunner);
    const result = await provider.suggest({
      queryContext: commandContext("docker logs w"),
      command: "docker",
      args: ["logs", "w"],
      binding: {
        providerId: "command-list",
        params: {
          program: "docker",
          args: ["ps", "-a", "--format", "{{.Names}}\t{{.Image}}\t{{.Status}}"],
          labelField: 0,
          descriptionField: 1,
          itemLabel: "container",
        },
      },
    });

    expect(result).toEqual([
      {
        label: "web",
        description: "nginx:latest",
      },
    ]);
  });
});
