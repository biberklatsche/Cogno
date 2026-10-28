import { AskpassRequest, AskpassRequests } from "@cogno/platform/askpass";
import { CommandRunner } from "@cogno/platform/command-runner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRunnerHostService } from "./command-runner-host.service";

const shellContext = { shellType: "Bash", backendOs: "linux" } as const;

describe("CommandRunnerHostService", () => {
  let execute: ReturnType<typeof vi.fn>;
  let answer: ReturnType<typeof vi.fn>;
  let request: (prompt: AskpassRequest) => void;
  let closed: (requestId: string) => void;
  let service: CommandRunnerHostService;

  beforeEach(() => {
    execute = vi.fn();
    answer = vi.fn().mockResolvedValue(true);
    const askpass = {
      onRequest: vi.fn((listener) => {
        request = listener;
        return Promise.resolve(() => undefined);
      }),
      onClosed: vi.fn((listener) => {
        closed = listener;
        return Promise.resolve(() => undefined);
      }),
      answer,
    } as unknown as AskpassRequests;
    service = new CommandRunnerHostService({ execute } as unknown as CommandRunner, askpass, {
      onDestroy: vi.fn(),
    } as never);
  });

  /** The prompt session the last `execute` was started with. */
  function promptSession(): string {
    return execute.mock.calls[0]?.[3] as string;
  }

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

  it("hands a prompt to the handler of the run that raised it", async () => {
    let finish!: (result: unknown) => void;
    execute.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const onPrompt = vi.fn().mockResolvedValue("secret");

    const running = service.run({ cwd: "/r", shellContext, program: "git", onPrompt });
    await Promise.resolve();
    request({ requestId: "r1", sessionId: promptSession(), prompt: "Password: " });
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", "secret"));
    expect(onPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Password: ", closed: expect.any(AbortSignal) }),
    );

    finish({ stdout: "", stderr: "", exitCode: 0 });
    await running;
  });

  it("refuses a prompt of a run without a handler", async () => {
    let finish!: (result: unknown) => void;
    execute.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const running = service.run({ cwd: "/r", shellContext, program: "git" });
    await Promise.resolve();
    request({ requestId: "r1", sessionId: promptSession(), prompt: "Password: " });
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));

    finish({ stdout: "", stderr: "", exitCode: 0 });
    await running;
  });

  it("refuses a prompt of a run that already ended", async () => {
    execute.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const onPrompt = vi.fn();
    await service.run({ cwd: "/r", shellContext, program: "git", onPrompt });

    request({ requestId: "r1", sessionId: promptSession(), prompt: "Password: " });

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it("aborts the handler when the process ends first and sends no answer", async () => {
    let finish!: (result: unknown) => void;
    execute.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    let aborted = false;
    const onPrompt = vi.fn(
      ({ closed: signal }: { closed: AbortSignal }) =>
        new Promise<string | null>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve(null);
          });
        }),
    );

    const running = service.run({ cwd: "/r", shellContext, program: "git", onPrompt });
    await Promise.resolve();
    request({ requestId: "r1", sessionId: promptSession(), prompt: "Password: " });
    await vi.waitFor(() => expect(onPrompt).toHaveBeenCalled());
    closed("r1");
    finish({ stdout: "", stderr: "", exitCode: 1 });
    await running;

    expect(aborted).toBe(true);
    expect(answer).not.toHaveBeenCalled();
  });
});
