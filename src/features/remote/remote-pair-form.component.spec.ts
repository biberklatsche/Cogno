import type { PairingPort } from "@cogno/core/api/pairing-port";
import { HostError } from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemotePairFormComponent } from "./remote-pair-form.component";

describe("RemotePairFormComponent", () => {
  let pairByCode: ReturnType<typeof vi.fn>;
  let closed: ReturnType<typeof vi.fn>;
  let form: RemotePairFormComponent;

  const type = (value: string) => form.setCode({ target: { value } } as unknown as Event);

  beforeEach(() => {
    pairByCode = vi.fn().mockResolvedValue("laptop");
    closed = vi.fn();
    form = new RemotePairFormComponent({ pairByCode } as unknown as PairingPort);
    form.closed.subscribe(closed);
  });

  it("shows the check number while the other machine asks, then whom it paired with", async () => {
    let paired!: (name: string) => void;
    pairByCode.mockImplementation((_code: string, onCheck: (check: string) => void) => {
      onCheck("123456");
      return new Promise((resolve) => (paired = resolve));
    });
    type(" K7Q-4MX ");

    const pairing = form.pair(new Event("submit"));

    expect(pairByCode).toHaveBeenCalledWith("K7Q-4MX", expect.any(Function));
    expect(form.waiting()).toBe(true);
    expect(form.check()).toBe("123456");

    paired("laptop");
    await pairing;
    expect(form.state()).toEqual({ step: "paired", name: "laptop" });
    expect(closed).not.toHaveBeenCalled();
  });

  it("asks nothing without a code", async () => {
    type("  ");

    await form.pair(new Event("submit"));

    expect(pairByCode).not.toHaveBeenCalled();
  });

  it.each([
    ["pairingCodeUnknown", "No machine shows this code"],
    ["pairingDeclined", "did not allow"],
    ["pairingOff", "Pairing is off"],
    ["pairingUnreachable", "Cogno's pairing server is not set up yet"],
  ] as const)("says why it did not pair (%s), and lets the user try again", async (code, text) => {
    pairByCode.mockRejectedValue(new HostError(code, "Cogno's pairing server is not set up yet"));
    type("K7Q-4MX");

    await form.pair(new Event("submit"));

    expect(form.error()).toContain(text);
    expect(form.state()).toEqual({ step: "entering" });

    type("K7Q-4MY");
    expect(form.error()).toBeUndefined();
  });
});
