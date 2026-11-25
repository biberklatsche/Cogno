import type { DestroyRef } from "@angular/core";
import type { PairingCheck, PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { HostError } from "@cogno/platform";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemotePairFormComponent } from "./remote-pair-form.component";

const office = { id: "abc", name: "office" };

/** Lets what was answered arrive. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("RemotePairFormComponent", () => {
  let state$: BehaviorSubject<PairingState>;
  let pair: ReturnType<typeof vi.fn>;
  let setOpen: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;
  let destroy: () => void;
  let form: RemotePairFormComponent;

  beforeEach(() => {
    state$ = new BehaviorSubject<PairingState>({ available: true, open: true, nearby: [office] });
    pair = vi.fn().mockResolvedValue("office");
    setOpen = vi.fn().mockResolvedValue(undefined);
    const destroyed: (() => void)[] = [];
    destroy = () => {
      for (const callback of destroyed) callback();
    };
    writeText = vi.fn().mockResolvedValue(undefined);
    form = new RemotePairFormComponent(
      { state$, pair, setOpen } as unknown as PairingPort,
      { writeText } as never,
      { onDestroy: (callback: () => void) => destroyed.push(callback) } as unknown as DestroyRef,
    );
  });

  it("has pairing open for as long as it is shown, and lists the machines nearby", () => {
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(form.nearby()).toEqual([office]);

    destroy();

    expect(setOpen).toHaveBeenLastCalledWith(false);
  });

  it("shows the number to compare, waits for the other machine, then says whom it paired with", async () => {
    let paired!: (name: string) => void;
    const answer = vi.fn();
    pair.mockImplementation((_id: string, onCheck: (check: PairingCheck) => void) => {
      onCheck({ check: "123456", answer });
      return new Promise((resolve) => (paired = resolve));
    });

    const pairing = form.pair(office);

    expect(pair).toHaveBeenCalledWith("abc", expect.any(Function));
    expect(form.state().step).toBe("comparing");
    expect(form.check()).toBe("123456");
    expect(form.machineName()).toBe("office");

    form.answer(true);
    expect(answer).toHaveBeenCalledWith(true);
    expect(form.state().step).toBe("confirmed");

    paired("office");
    await pairing;
    expect(form.state()).toEqual({ step: "paired", name: "office" });
  });

  it("goes back to choosing, with the reason, when the numbers do not match", async () => {
    pair.mockImplementation((_id: string, onCheck: (check: PairingCheck) => void) => {
      return new Promise((_resolve, reject) =>
        onCheck({
          check: "123456",
          answer: () => reject(new HostError("pairingDeclined", "not confirmed")),
        }),
      );
    });

    const pairing = form.pair(office);
    form.answer(false);
    await pairing;

    expect(form.state()).toEqual({ step: "choosing" });
    expect(form.error()).toContain("not confirmed on both machines");
  });

  it("says in the app's words why the other machine was not reached", async () => {
    pair.mockRejectedValue(new HostError("pairingUnreachable", "Could not reach the machine"));

    await form.pair(office);

    expect(form.error()).toBe("Could not reach the machine");
    expect(form.state()).toEqual({ step: "choosing" });
  });

  it("asks one machine at a time", async () => {
    pair.mockReturnValue(new Promise(() => undefined));

    void form.pair(office);
    void form.pair({ id: "def", name: "laptop" });
    await settled();

    expect(pair).toHaveBeenCalledOnce();
  });

  describe("with a machine in another network", () => {
    const invitation = "ab".repeat(32);
    const paste = (value: string) => form.setPasted({ target: { value } } as unknown as Event);

    beforeEach(() => {
      state$.next({ available: true, open: true, nearby: [], invitation });
    });

    it("copies this machine's invitation", async () => {
      await form.copyInvitation();

      expect(writeText).toHaveBeenCalledWith(invitation);
      expect(form.copied()).toBe(true);
    });

    it("pairs with the machine whose invitation was pasted", async () => {
      paste(`  ${"CD".repeat(32)} `);

      await form.pairByInvitation(new Event("submit"));

      expect(pair).toHaveBeenCalledWith("cd".repeat(32), expect.any(Function));
      expect(form.state()).toEqual({ step: "paired", name: "office" });
      expect(form.pasted()).toBe("");
    });

    it("asks nobody when what was pasted is no invitation", async () => {
      paste("K7Q-4MX");

      await form.pairByInvitation(new Event("submit"));

      expect(pair).not.toHaveBeenCalled();
      expect(form.error()).toContain("not an invitation");
    });

    it("offers no invitation where only this network is reached", () => {
      state$.next({ available: true, open: true, nearby: [] });

      expect(form.invitation()).toBeUndefined();
    });
  });

  it("says why pairing does not work on this machine", () => {
    state$.next({ available: false, reason: "Could not bind" });

    expect(form.unavailable()).toBe("Could not bind");
    expect(form.nearby()).toEqual([]);
  });
});
