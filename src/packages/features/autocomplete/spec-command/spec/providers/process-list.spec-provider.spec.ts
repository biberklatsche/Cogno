import { CommandRunnerContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecProviderContext } from "../spec.types";
import { ProcessListSpecProvider } from "./process-list.spec-provider";

function createContext(backendOs: "linux" | "windows"): SpecProviderContext {
  return {
    binding: { providerId: "process-list" },
    command: "kill",
    args: [],
    queryContext: {
      cwd: "/workspace",
      shellContext: {
        backendOs,
        shellType: backendOs === "windows" ? "PowerShell" : "Bash",
      },
    },
    timeoutMs: 250,
  };
}

describe("ProcessListSpecProvider", () => {
  let commandRunner: CommandRunnerContract;
  let provider: ProcessListSpecProvider;

  beforeEach(() => {
    commandRunner = {
      run: vi.fn(),
    };
    provider = new ProcessListSpecProvider(commandRunner);
  });

  it("returns no suggestions when the binding does not match", async () => {
    const context = {
      ...createContext("linux"),
      binding: { providerId: "ssh-hosts" },
    } as SpecProviderContext;

    await expect(provider.suggest(context)).resolves.toEqual([]);
    expect(commandRunner.run).not.toHaveBeenCalled();
  });

  it("parses unix process lists", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 0,
      stdout: "123 bash\n456 node /tmp/script\ninvalid\n",
      stderr: "",
    });

    await expect(provider.suggest(createContext("linux"))).resolves.toEqual([
      { label: "123 bash", insertText: "123", description: "bash" },
      { label: "456 node /tmp/script", insertText: "456", description: "node /tmp/script" },
    ]);
    expect(commandRunner.run).toHaveBeenCalledWith({
      cwd: "/workspace",
      shellContext: {
        backendOs: "linux",
        shellType: "Bash",
      },
      program: "ps",
      args: ["-e", "-o", "pid=", "-o", "comm="],
      timeoutMs: 250,
    });
  });

  it("parses quoted csv tasklist output on windows", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 0,
      stdout: '"Code.exe","4711","Console","1","123,456 K"\n"bad","pid","Console","1","100 K"\n',
      stderr: "",
    });

    await expect(provider.suggest(createContext("windows"))).resolves.toEqual([
      { label: "4711 Code.exe", insertText: "4711", description: "Code.exe" },
    ]);
    expect(commandRunner.run).toHaveBeenCalledWith({
      cwd: "/workspace",
      shellContext: {
        backendOs: "windows",
        shellType: "PowerShell",
      },
      program: "tasklist",
      args: ["/FO", "CSV", "/NH"],
      timeoutMs: 250,
    });
  });

  it("caches successful results within the ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T10:00:00.000Z"));
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 0,
      stdout: "123 bash\n",
      stderr: "",
    });

    const firstSuggestions = await provider.suggest(createContext("linux"));
    const secondSuggestions = await provider.suggest(createContext("linux"));

    expect(firstSuggestions).toEqual(secondSuggestions);
    expect(commandRunner.run).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("returns an empty list for failed or empty command output", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "failure",
    });

    await expect(provider.suggest(createContext("linux"))).resolves.toEqual([]);
  });
});
