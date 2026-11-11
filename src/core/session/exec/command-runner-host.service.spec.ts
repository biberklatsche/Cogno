import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { CommandRunner } from "@cogno/platform/command-runner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRunnerHostService } from "./command-runner-host.service";

const shellContext = { shellType: "Bash", backendOs: "linux" } as const;

describe("CommandRunnerHostService", () => {
  let execute: ReturnType<typeof vi.fn>;
  let register: ReturnType<typeof vi.fn>;
  let forgetHandler: ReturnType<typeof vi.fn>;
  let service: CommandRunnerHostService;

  beforeEach(() => {
    execute = vi.fn();
    forgetHandler = vi.fn();
    register = vi.fn().mockReturnValue(forgetHandler);
    service = new CommandRunnerHostService(
      { execute } as unknown as CommandRunner,
      { register } as unknown as ProcessPromptDispatcher,
    );
  });

  it("normalizes windows cwd before backend execution", async () => {
    execute.mockResolvedValue({ stdout: "main", stderr: "", exitCode: 0 });

    const result = await service.run({
      cwd: "C:\\repo\\project",
      shellContext: { shellType: "PowerShell", backendOs: "windows" },
      program: "git",
      args: ["tag", "--list"],
    });

    expect(execute).toHaveBeenCalledWith(
      "git",
      ["tag", "--list"],
      "C:\\repo\\project",
      expect.any(String),
      undefined,
      undefined,
    );
    expect(result.exitCode).toBe(0);
  });

  it("answers a run's prompts with its handler for as long as it runs", async () => {
    let finish!: (result: unknown) => void;
    execute.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const onPrompt = vi.fn();

    const running = service.run({ cwd: "/r", shellContext, program: "git", onPrompt });
    await Promise.resolve();
    // The session the backend was given is the one the handler answers.
    expect(register).toHaveBeenCalledWith(execute.mock.calls[0]?.[3], onPrompt);
    expect(forgetHandler).not.toHaveBeenCalled();

    finish({ stdout: "", stderr: "", exitCode: 0 });
    await running;
    expect(forgetHandler).toHaveBeenCalledOnce();
  });

  it("registers nothing for a run without a handler: its prompts are refused", async () => {
    execute.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await service.run({ cwd: "/r", shellContext, program: "git" });

    expect(register).not.toHaveBeenCalled();
  });

  it("forgets the handler of a run that failed to start", async () => {
    execute.mockRejectedValue(new Error("spawn failed"));

    const result = await service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      onPrompt: vi.fn(),
    });

    expect(result).toEqual({ stdout: "", stderr: "spawn failed", exitCode: 1 });
    expect(forgetHandler).toHaveBeenCalledOnce();
  });
});
