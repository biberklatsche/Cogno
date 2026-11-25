import type { Pairing, PairingRequestContract } from "@cogno/platform";
import { DialogRef, type DialogService } from "@cogno/shared/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemotePairingRequestPrompt } from "./remote-pairing-request.prompt";

describe("RemotePairingRequestPrompt", () => {
  let request: (request: PairingRequestContract) => void;
  let ended: (id: number) => void;
  let answer: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let dialog: DialogRef<boolean>;
  let unlisten: ReturnType<typeof vi.fn>;
  let onRequest: ReturnType<typeof vi.fn>;
  let prompt: RemotePairingRequestPrompt;

  beforeEach(() => {
    answer = vi.fn().mockResolvedValue(undefined);
    open = vi.fn(() => {
      dialog = new DialogRef<boolean>(1, () => undefined);
      return dialog;
    });
    unlisten = vi.fn();
    onRequest = vi.fn((listener) => {
      request = listener;
      return Promise.resolve(unlisten);
    });
    prompt = new RemotePairingRequestPrompt(
      {
        answer,
        onRequest,
        onRequestEnded: vi.fn((listener) => {
          ended = listener;
          return Promise.resolve(unlisten);
        }),
      } as unknown as Pairing,
      { open } as unknown as DialogService,
    );
    prompt.listen();
  });

  it("listens once while it does, and not at all once it was stopped", async () => {
    prompt.listen();
    expect(onRequest).toHaveBeenCalledOnce();

    prompt.stop();
    await Promise.resolve();
    await Promise.resolve();
    // Both listeners are gone.
    expect(unlisten).toHaveBeenCalledTimes(2);

    prompt.listen();
    expect(onRequest).toHaveBeenCalledTimes(2);
  });

  it("asks the user, naming the machine and the number it shows", () => {
    request({ id: 1, name: "laptop", check: "123456" });

    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][1].data).toMatchObject({
      message: "laptop wants to pair with this machine. Does it show 123456?",
      confirmLabel: "They match",
      cancelLabel: "Decline",
    });
  });

  it("confirms when the user says the numbers match", async () => {
    request({ id: 1, name: "laptop", check: "123456" });

    dialog.close(true);

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(1, true));
  });

  it("declines when the dialog is closed any other way", async () => {
    request({ id: 1, name: "laptop", check: "123456" });

    dialog.close();

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(1, false));
  });

  it("closes the dialog unanswered when the request ends first", async () => {
    request({ id: 1, name: "laptop", check: "123456" });

    ended(1);
    await Promise.resolve();

    expect(dialog.closed()).toBe(false);
    expect(answer).not.toHaveBeenCalled();
  });

  it("leaves the dialog of another request open", () => {
    request({ id: 1, name: "laptop", check: "123456" });

    ended(2);

    expect(dialog.closed()).toBeUndefined();
  });
});
