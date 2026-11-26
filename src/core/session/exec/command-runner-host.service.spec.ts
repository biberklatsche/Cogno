import { CommandRunner } from "@cogno/platform/command-runner";
import { RunQuestion, RunQuestions } from "@cogno/platform/run-questions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRunnerHostService } from "./command-runner-host.service";

const shellContext = { shellType: "Bash", backendOs: "linux" } as const;

describe("CommandRunnerHostService", () => {
  let execute: ReturnType<typeof vi.fn>;
  let answer: ReturnType<typeof vi.fn>;
  let ask: (question: RunQuestion) => void;
  let closed: (requestId: string) => void;
  let service: CommandRunnerHostService;
  /** Ends the command a test left running. */
  let finish: (result: unknown) => void;

  beforeEach(() => {
    execute = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    answer = vi.fn().mockResolvedValue(true);
    const questions = {
      onQuestion: vi.fn((listener) => {
        ask = listener;
        return Promise.resolve(() => undefined);
      }),
      onClosed: vi.fn((listener) => {
        closed = listener;
        return Promise.resolve(() => undefined);
      }),
      answer,
    } as unknown as RunQuestions;
    service = new CommandRunnerHostService({ execute } as unknown as CommandRunner, questions, {
      onDestroy: vi.fn(),
    } as never);
  });

  /** The prompt session the last `execute` was started with. */
  function promptSession(): string {
    return execute.mock.calls.at(-1)?.[3] as string;
  }

  const prompt = (requestId = "r1"): RunQuestion => ({
    requestId,
    sessionId: promptSession(),
    kind: "prompt",
    payload: { text: "Passphrase: " },
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
      [],
      undefined,
      undefined,
    );
    expect(result.exitCode).toBe(0);
  });

  it("starts a run naming the kinds of question it has somebody for", async () => {
    execute.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: vi.fn(), credential: vi.fn(), credentialRejected: vi.fn() },
    });
    await service.run({ cwd: "/r", shellContext, program: "git", answers: { prompt: vi.fn() } });

    expect(execute.mock.calls.map((call) => call[4])).toEqual([
      ["prompt", "credential", "credential_rejected"],
      ["prompt"],
    ]);
  });

  it("hands a prompt to the run that raised it", async () => {
    const answerPrompt = vi.fn().mockResolvedValue("secret");

    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: answerPrompt },
    });
    await Promise.resolve();
    ask(prompt());
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", "secret"));
    expect(answerPrompt).toHaveBeenCalledWith({
      text: "Passphrase: ",
      closed: expect.any(AbortSignal),
    });

    finish({ stdout: "", stderr: "", exitCode: 0 });
    await running;
  });

  it("hands a credential request to the run that raised it", async () => {
    const credential = vi.fn().mockResolvedValue({ kind: "signed_in" });

    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { credential },
    });
    await Promise.resolve();
    ask({
      requestId: "c1",
      sessionId: promptSession(),
      kind: "credential",
      payload: { origin: "https://gitlab.com" },
    });
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("c1", { kind: "signed_in" }));
    expect(credential).toHaveBeenCalledWith({
      origin: "https://gitlab.com",
      closed: expect.any(AbortSignal),
    });

    finish({ stdout: "", stderr: "", exitCode: 0 });
    await running;
  });

  it("tells the run of a rejected credential and says it was heard", async () => {
    const credentialRejected = vi.fn();

    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { credentialRejected },
    });
    await Promise.resolve();
    ask({
      requestId: "e1",
      sessionId: promptSession(),
      kind: "credential_rejected",
      payload: { origin: "https://gitlab.com" },
    });
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("e1", true));
    expect(credentialRejected).toHaveBeenCalledWith("https://gitlab.com");

    finish({ stdout: "", stderr: "", exitCode: 1 });
    await running;
  });

  it("refuses what the run dismissed", async () => {
    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: vi.fn().mockResolvedValue(null) },
    });
    await Promise.resolve();
    ask(prompt());
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));

    finish({ stdout: "", stderr: "", exitCode: 1 });
    await running;
  });

  it("refuses a question whose answer throws", async () => {
    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: vi.fn().mockRejectedValue(new Error("dialog broke")) },
    });
    await Promise.resolve();
    ask(prompt());
    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));

    finish({ stdout: "", stderr: "", exitCode: 1 });
    await running;
  });

  it("refuses a question of a run that already ended", async () => {
    execute.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const answerPrompt = vi.fn();
    await service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: answerPrompt },
    });

    ask(prompt());

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));
    expect(answerPrompt).not.toHaveBeenCalled();
  });

  it("aborts the answer when the process ends first and sends none", async () => {
    let aborted = false;
    const answerPrompt = vi.fn(
      ({ closed: signal }: { closed: AbortSignal }) =>
        new Promise<string | null>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve(null);
          });
        }),
    );

    const running = service.run({
      cwd: "/r",
      shellContext,
      program: "git",
      answers: { prompt: answerPrompt },
    });
    await Promise.resolve();
    ask(prompt());
    await vi.waitFor(() => expect(answerPrompt).toHaveBeenCalled());
    closed("r1");
    finish({ stdout: "", stderr: "", exitCode: 1 });
    await running;

    expect(aborted).toBe(true);
    expect(answer).not.toHaveBeenCalled();
  });
});
