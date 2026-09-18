import { CommandRunner } from "@cogno/platform/command-runner";
import { describe, expect, it, vi } from "vitest";
import { CommandRunnerHostService } from "./command-runner-host.service";

const commandRunnerStub = {
  execute: vi.fn(),
} as unknown as CommandRunner;

describe("CommandRunnerHostService", () => {
  it("normalizes windows cwd before backend execution", async () => {
    vi.mocked(commandRunnerStub.execute).mockResolvedValue({
      stdout: "main",
      stderr: "",
      exitCode: 0,
    });

    const service = new CommandRunnerHostService(commandRunnerStub);
    const result = await service.run({
      cwd: "C:\\repo\\project",
      shellContext: {
        shellType: "PowerShell",
        backendOs: "windows",
      },
      program: "git",
      args: ["tag", "--list"],
    });

    expect(commandRunnerStub.execute).toHaveBeenCalledWith(
      "git",
      ["tag", "--list"],
      "C:\\repo\\project",
      undefined,
    );
    expect(result.exitCode).toBe(0);
  });
});
