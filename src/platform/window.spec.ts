import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppWindow } from "./window";

const invokeMock = vi.hoisted(() => vi.fn<(command: string, args?: unknown) => Promise<unknown>>());
const listenMock = vi.hoisted(() =>
  vi.fn<(event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>>(),
);

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ listen: listenMock }),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("./logger", () => ({ Logger: { warn: vi.fn() } }));

/** Subscribes the answering, delivers one request and waits until it is answered. */
async function request(handler: (phase: "confirm" | "persist") => Promise<boolean>) {
  let deliver!: (event: { payload: unknown }) => void;
  listenMock.mockImplementation(async (_event, listener) => {
    deliver = listener;
    return () => {};
  });
  const answered = firstValueFrom(new AppWindow().answerQuitRequests(handler));
  await vi.waitFor(() => expect(listenMock).toHaveBeenCalled());
  deliver({ payload: { requestId: "r1", phase: "confirm" } });
  await answered;
}

describe("AppWindow.answerQuitRequests", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    listenMock.mockReset();
  });

  it("listens on this window only, confirms receipt first, then answers", async () => {
    let finish!: (accepted: boolean) => void;
    const handler = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const done = request(handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith("confirm"));

    expect(listenMock).toHaveBeenCalledWith("cogno-prepare-quit", expect.any(Function));
    expect(invokeMock.mock.calls).toEqual([["window_receive_quit", { requestId: "r1" }]]);
    finish(true);
    await done;
    expect(invokeMock).toHaveBeenLastCalledWith("window_answer_quit", {
      requestId: "r1",
      accepted: true,
    });
  });

  it("answers yes when the handler fails: quitting wins over a technical failure", async () => {
    await request(() => Promise.reject(new Error("Save failed")));
    expect(invokeMock).toHaveBeenLastCalledWith("window_answer_quit", {
      requestId: "r1",
      accepted: true,
    });
  });

  it("still asks the handler when the receipt cannot be sent", async () => {
    invokeMock.mockRejectedValueOnce(new Error("ipc down"));
    const handler = vi.fn().mockResolvedValue(false);
    await request(handler);
    expect(handler).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenLastCalledWith("window_answer_quit", {
      requestId: "r1",
      accepted: false,
    });
  });
});
