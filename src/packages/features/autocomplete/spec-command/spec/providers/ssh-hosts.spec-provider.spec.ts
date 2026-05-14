import { CommandRunnerContract, FilesystemContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecProviderContext } from "../spec.types";
import { SshHostsSpecProvider } from "./ssh-hosts.spec-provider";

function createContext(backendOs: "linux" | "windows"): SpecProviderContext {
  return {
    binding: { providerId: "ssh-hosts" },
    command: "ssh",
    args: [],
    queryContext: {
      cwd: "/workspace",
      shellContext: {
        backendOs,
        shellType: backendOs === "windows" ? "PowerShell" : "Bash",
      },
    },
    timeoutMs: 500,
  };
}

describe("SshHostsSpecProvider", () => {
  let filesystem: FilesystemContract;
  let commandRunner: CommandRunnerContract;
  let provider: SshHostsSpecProvider;

  beforeEach(() => {
    filesystem = {
      exists: vi.fn(),
      readTextFile: vi.fn(),
      resolvePath: vi.fn((basePath: string, relativePath: string) => `${basePath}/${relativePath}`),
    };
    commandRunner = {
      run: vi.fn(),
    };
    provider = new SshHostsSpecProvider(filesystem, commandRunner);
  });

  it("returns no suggestions when the binding does not match", async () => {
    const context = {
      ...createContext("linux"),
      binding: { providerId: "process-list" },
    } as SpecProviderContext;

    await expect(provider.suggest(context)).resolves.toEqual([]);
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("collects hosts from ssh config and known_hosts", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 0,
      stdout: "/Users/tester\n",
      stderr: "",
    });
    vi.mocked(filesystem.exists).mockResolvedValue(true);
    vi.mocked(filesystem.readTextFile)
      .mockResolvedValueOnce(
        ["# comment", "Host app db *.wildcard !negated", "Host jump", "Host ?wildcard"].join("\n"),
      )
      .mockResolvedValueOnce(
        [
          "github.com ssh-rsa AAA",
          "[server.internal]:2222 ssh-ed25519 BBB",
          "gitlab.com,alias.example ssh-ed25519 CCC",
          "|1|hashed ignored",
        ].join("\n"),
      );

    await expect(provider.suggest(createContext("linux"))).resolves.toEqual([
      { label: "alias.example", description: "ssh host" },
      { label: "app", description: "ssh host" },
      { label: "db", description: "ssh host" },
      { label: "github.com", description: "ssh host" },
      { label: "gitlab.com", description: "ssh host" },
      { label: "jump", description: "ssh host" },
      { label: "server.internal", description: "ssh host" },
    ]);
  });

  it("uses cached home directories and suggestion ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T10:00:00.000Z"));
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 0,
      stdout: "/home/tester\n",
      stderr: "",
    });
    vi.mocked(filesystem.exists).mockResolvedValue(false);

    const firstSuggestions = await provider.suggest(createContext("linux"));
    const secondSuggestions = await provider.suggest(createContext("linux"));

    expect(firstSuggestions).toEqual([]);
    expect(secondSuggestions).toEqual([]);
    expect(commandRunner.run).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("returns no suggestions when the home directory cannot be resolved", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "missing",
    });

    await expect(provider.suggest(createContext("windows"))).resolves.toEqual([]);
    expect(filesystem.exists).not.toHaveBeenCalled();
  });
});
