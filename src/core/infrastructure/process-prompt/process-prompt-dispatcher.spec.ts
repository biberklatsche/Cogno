import { AskpassRequest, AskpassRequests } from "@cogno/platform/askpass";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProcessPromptDispatcher } from "./process-prompt-dispatcher";

describe("ProcessPromptDispatcher", () => {
  let answer: ReturnType<typeof vi.fn>;
  let request: (prompt: AskpassRequest) => void;
  let closed: (requestId: string) => void;
  let dispatcher: ProcessPromptDispatcher;

  beforeEach(() => {
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
    dispatcher = new ProcessPromptDispatcher(askpass, { onDestroy: vi.fn() } as never);
  });

  it("hands a prompt to the handler registered for its session", async () => {
    const handler = vi.fn().mockResolvedValue("secret");
    dispatcher.register("s1", handler);

    request({ requestId: "r1", sessionId: "s1", prompt: "Password: " });

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", "secret"));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Password: ", closed: expect.any(AbortSignal) }),
    );
  });

  it("refuses a prompt of a session nobody registered", async () => {
    request({ requestId: "r1", sessionId: "unknown", prompt: "Password: " });

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));
  });

  it("refuses a prompt once its session was unregistered", async () => {
    const handler = vi.fn();
    const unregister = dispatcher.register("s1", handler);
    unregister();

    request({ requestId: "r1", sessionId: "s1", prompt: "Password: " });

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a prompt whose handler fails", async () => {
    dispatcher.register("s1", vi.fn().mockRejectedValue(new Error("dialog broke")));

    request({ requestId: "r1", sessionId: "s1", prompt: "Password: " });

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith("r1", null));
  });

  it("aborts the handler when the process ends first and sends no answer", async () => {
    let aborted = false;
    const handler = vi.fn(
      ({ closed: signal }: { closed: AbortSignal }) =>
        new Promise<string | null>((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve(null);
          });
        }),
    );
    dispatcher.register("s1", handler);

    request({ requestId: "r1", sessionId: "s1", prompt: "Password: " });
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    closed("r1");
    await Promise.resolve();
    await Promise.resolve();

    expect(aborted).toBe(true);
    expect(answer).not.toHaveBeenCalled();
  });
});
