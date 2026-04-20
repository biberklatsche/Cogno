import { CommandRunner } from "@cogno/app-tauri/command-runner";
import { describe, expect, it, vi } from "vitest";
import { CommandRunnerHostService } from "./command-runner-host.service";

vi.mock("@cogno/app-tauri/command-runner", () => ({
  CommandRunner: {
    execute: vi.fn(),
  },
}));

describe("CommandRunnerHostService", () => {
  it("normalizes windows cwd before backend execution", async () => {
    vi.mocked(CommandRunner.execute).mockResolvedValue({
      stdout: "main",
      stderr: "",
      exitCode: 0,
    });

    const service = new CommandRunnerHostService();
    const result = await service.run({
      cwd: "C:\\repo\\project",
      shellContext: {
        shellType: "PowerShell",
        backendOs: "windows",
      },
      program: "git",
      args: ["tag", "--list"],
    });

    expect(CommandRunner.execute).toHaveBeenCalledWith(
      "git",
      ["tag", "--list"],
      "C:\\repo\\project",
      undefined,
    );
    expect(result.exitCode).toBe(0);
  });
});
