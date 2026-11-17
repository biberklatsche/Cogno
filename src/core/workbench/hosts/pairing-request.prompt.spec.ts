import type { Pairing, PairingRequestContract } from "@cogno/platform";
import { DialogRef, type DialogService } from "@cogno/shared/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PairingService } from "./pairing.service";
import { PairingRequestPrompt, uniqueName } from "./pairing-request.prompt";

describe("uniqueName", () => {
  it("keeps a free name and numbers a taken one", () => {
    expect(uniqueName(" laptop ", ["office"])).toBe("laptop");
    expect(uniqueName("laptop", ["laptop", "laptop 2"])).toBe("laptop 3");
  });

  it("names a machine that did not say how it calls itself", () => {
    expect(uniqueName(null, [])).toBe("machine");
    expect(uniqueName(" ", ["machine"])).toBe("machine 2");
  });
});

describe("PairingRequestPrompt", () => {
  let request: (request: PairingRequestContract) => void;
  let ended: (id: number) => void;
  let answer: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let dialog: DialogRef<boolean>;

  beforeEach(() => {
    answer = vi.fn().mockResolvedValue(undefined);
    open = vi.fn(() => {
      dialog = new DialogRef<boolean>(1, () => undefined);
      return dialog;
    });
    new PairingRequestPrompt(
      {
        answer,
        onRequest: vi.fn((listener) => {
          request = listener;
          return Promise.resolve(() => undefined);
        }),
        onRequestEnded: vi.fn((listener) => {
          ended = listener;
          return Promise.resolve(() => undefined);
        }),
      } as unknown as Pairing,
      { remoteNames: () => ["laptop", "office"] } as unknown as PairingService,
      { open } as unknown as DialogService,
      { onDestroy: vi.fn() } as never,
    );
  });

  it("asks the user, naming the machine and the number it shows", () => {
    request({ id: 1, name: "laptop", check: "123456" });

    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][1].data).toMatchObject({
      message: "laptop wants to pair with this machine. Check that it shows 123456.",
      confirmLabel: "Allow",
      cancelLabel: "Decline",
    });
  });

  it("says 'A machine' for one that does not say how it calls itself", () => {
    request({ id: 1, name: null, check: "123456" });

    expect(open.mock.calls[0][1].data.message).toMatch(/^A machine wants to pair/);
  });

  it("allows under a name no other remote has", async () => {
    request({ id: 1, name: "laptop", check: "123456" });

    dialog.close(true);

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(1, "laptop 2"));
  });

  it("declines when the dialog is closed any other way", async () => {
    request({ id: 1, name: "laptop", check: "123456" });

    dialog.close();

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith(1, null));
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
