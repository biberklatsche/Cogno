import { beforeEach, describe, expect, it, vi } from "vitest";
import { HostError } from "./host-error";
import { Pairing } from "./pairing";

const invokeMock = vi.hoisted(() => vi.fn<(command: string, args?: unknown) => Promise<unknown>>());

const listenMock = vi.hoisted(() =>
  vi.fn<(event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>>(),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  Channel: class {
    onmessage: (message: unknown) => void = () => undefined;
  },
}));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ listen: listenMock }),
}));

describe("Pairing", () => {
  let pairing: Pairing;

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => undefined);
    pairing = new Pairing();
  });

  it("asks for the state and passes commands on with their arguments", async () => {
    const state = { machines: [], open: false, nearby: [] };
    invokeMock.mockResolvedValueOnce(state);
    await expect(pairing.state()).resolves.toEqual(state);
    expect(invokeMock).toHaveBeenLastCalledWith("pairing_state", undefined);

    await pairing.answer(3, true);
    expect(invokeMock).toHaveBeenLastCalledWith("pairing_answer", { id: 3, confirmed: true });

    await pairing.setOpen(true);
    expect(invokeMock).toHaveBeenLastCalledWith("pairing_set_open", { open: true });

    await pairing.rename("office", "work");
    expect(invokeMock).toHaveBeenLastCalledWith("pairing_rename", {
      previous: "office",
      name: "work",
    });

    invokeMock.mockResolvedValueOnce(false);
    await expect(pairing.remove("work")).resolves.toBe(false);
    expect(invokeMock).toHaveBeenLastCalledWith("pairing_remove", { name: "work" });
  });

  it("hands the request with the check number to the caller while both users compare", async () => {
    const onRequest = vi.fn();
    invokeMock.mockResolvedValueOnce({ name: "office", endpointId: "abc" });

    await expect(pairing.pair("abc", onRequest)).resolves.toEqual({
      name: "office",
      endpointId: "abc",
    });

    const [command, args] = invokeMock.mock.calls[0] as [
      string,
      { id: string; onRequest: { onmessage: (request: unknown) => void } },
    ];
    expect(command).toBe("pairing_pair");
    expect(args).toMatchObject({ id: "abc" });
    args.onRequest.onmessage({ id: 1, name: "office", check: "123456" });
    expect(onRequest).toHaveBeenCalledWith({ id: 1, name: "office", check: "123456" });
  });

  it("rejects with the code the app gave", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "pairingUnreachable",
      message: "Could not reach the other machine",
    });

    const failure = pairing.pair("abc", vi.fn());

    await expect(failure).rejects.toBeInstanceOf(HostError);
    await expect(failure).rejects.toMatchObject({ code: "pairingUnreachable" });
  });

  it("hears requests, their end and changes as this window hears them", async () => {
    const requests = vi.fn();
    const ended = vi.fn();
    const changed = vi.fn();
    await pairing.onRequest(requests);
    await pairing.onRequestEnded(ended);
    await pairing.onChanged(changed);

    const handlers = new Map(listenMock.mock.calls);
    handlers.get("pairing-request")!({ payload: { id: 1, name: null, check: "123456" } });
    handlers.get("pairing-request-ended")!({ payload: 1 });
    handlers.get("pairing-changed")!({ payload: null });

    expect(requests).toHaveBeenCalledWith({ id: 1, name: null, check: "123456" });
    expect(ended).toHaveBeenCalledWith(1);
    expect(changed).toHaveBeenCalledOnce();
  });
});
