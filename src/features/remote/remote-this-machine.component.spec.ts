import type { PairingPort, PairingState } from "@cogno/core/api/pairing-port";
import { HostError } from "@cogno/platform";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteThisMachineComponent } from "./remote-this-machine.component";

describe("RemoteThisMachineComponent", () => {
  let state$: BehaviorSubject<PairingState>;
  let pairing: { [K in "createCode" | "cancelCode" | "setAccepting"]: ReturnType<typeof vi.fn> };
  let component: RemoteThisMachineComponent;

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    state$ = new BehaviorSubject<PairingState>({
      available: true,
      accepting: true,
      addresses: [],
    });
    pairing = {
      createCode: vi.fn().mockResolvedValue(undefined),
      cancelCode: vi.fn().mockResolvedValue(undefined),
      setAccepting: vi.fn().mockResolvedValue(undefined),
    };
    component = new RemoteThisMachineComponent(
      { state$, ...pairing } as unknown as PairingPort,
      { onDestroy: vi.fn() } as never,
    );
  });

  afterEach(() => vi.useRealTimers());

  it("shows the code in two halves with the time it has left, until it runs out", () => {
    state$.next({
      available: true,
      accepting: true,
      code: { code: "k7q4mx", expiresAt: 1_000_000 + 65_000 },
      addresses: [],
    });
    expect(component.shownCode()).toEqual({ code: "K7Q-4MX", left: "1:05" });

    vi.advanceTimersByTime(6_000);
    expect(component.shownCode()?.left).toBe("0:59");

    vi.advanceTimersByTime(60_000);
    expect(component.shownCode()).toBeUndefined();
  });

  it("says why the last thing asked for did not work", async () => {
    pairing.createCode.mockRejectedValue(
      new HostError("pairingUnreachable", "Cogno's pairing server is not set up yet"),
    );

    await component.createCode();

    expect(component.failure()).toBe("Cogno's pairing server is not set up yet");
    expect(component.creating()).toBe(false);

    await component.setAccepting(false);
    expect(pairing.setAccepting).toHaveBeenCalledWith(false);
    expect(component.failure()).toBeUndefined();
  });

  it("knows where other machines reach this one directly", () => {
    expect(component.directAddresses()).toBeUndefined();

    state$.next({
      available: true,
      accepting: true,
      addresses: ["192.168.1.5:7844", "10.0.0.7:7844"],
    });

    expect(component.directAddresses()).toBe("192.168.1.5:7844, 10.0.0.7:7844");
  });
});
