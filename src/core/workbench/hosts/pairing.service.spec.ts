import type { PairingState } from "@cogno/core/api/pairing-port";
import { HostError, type Pairing, type PairingStateContract } from "@cogno/platform";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PairingService } from "./pairing.service";

const NO_HOST = new HostError("pairingOff", "This machine's Cogno host could not be opened");

function stateOf(overrides: Partial<PairingStateContract> = {}): PairingStateContract {
  return {
    invitation: null,
    machines: [],
    open: false,
    nearby: [],
    ...overrides,
  };
}

/** Lets what was answered arrive. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("PairingService", () => {
  let changed: () => void;
  let pairing: {
    [K in "state" | "enable" | "disable" | "pair" | "answer" | "setOpen"]: ReturnType<typeof vi.fn>;
  };
  let service: PairingService;
  let states: PairingState[];
  let config$: BehaviorSubject<{ remote?: { relay?: string } }>;

  function create(): void {
    service = new PairingService(
      {
        ...pairing,
        onChanged: vi.fn((listener) => {
          changed = listener;
          return Promise.resolve(() => undefined);
        }),
      } as unknown as Pairing,
      {
        config$,
        get config() {
          return config$.value;
        },
      } as never,
      { onDestroy: vi.fn() } as never,
    );
    states = [];
    service.state$.subscribe((state) => states.push(state));
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    config$ = new BehaviorSubject<{ remote?: { relay?: string } }>({
      remote: { relay: "https://relay.example" },
    });
    pairing = {
      state: vi.fn().mockResolvedValue(stateOf()),
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
      pair: vi.fn().mockResolvedValue({ name: "laptop", endpointId: "abc" }),
      answer: vi.fn().mockResolvedValue(undefined),
      setOpen: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => vi.useRealTimers());

  it("says nothing until pairing answered, then reads again whenever it changed", async () => {
    create();
    expect(states).toEqual([]);

    await settled();
    expect(states.at(-1)).toEqual({
      available: true,
      open: false,
      nearby: [],
      invitation: undefined,
    });

    pairing.state.mockResolvedValue(
      stateOf({
        machines: [{ name: "laptop", endpointId: "abc" }],
        open: true,
        nearby: [{ id: "def", name: "office" }],
      }),
    );
    changed();
    await settled();

    expect(states.at(-1)).toEqual({
      available: true,
      open: true,
      nearby: [{ id: "def", name: "office" }],
      invitation: undefined,
    });
    expect(service.machines.map(({ name }) => name)).toEqual(["laptop"]);
  });

  it("says why pairing does not work, and knows no paired machines then", async () => {
    pairing.state.mockRejectedValue(NO_HOST);
    create();
    await settled();

    expect(states.at(-1)).toEqual({
      available: false,
      reason: "This machine's Cogno host could not be opened",
    });
    expect(service.machines).toEqual([]);
  });

  it("takes only the newest answer, also when an older one comes last", async () => {
    let answerFirst!: (state: PairingStateContract) => void;
    pairing.state.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
    create();
    pairing.state.mockResolvedValue(stateOf({ machines: [{ name: "new", endpointId: "b" }] }));
    changed();
    await settled();

    answerFirst(stateOf({ machines: [{ name: "old", endpointId: "a" }] }));
    await settled();

    expect(service.machines.map(({ name }) => name)).toEqual(["new"]);
  });

  it("switches pairing on with the relay of the config, or without one when it is off", async () => {
    create();

    await service.enable();
    expect(pairing.enable).toHaveBeenLastCalledWith("https://relay.example");

    config$.next({ remote: { relay: "off" } });
    await settled();
    // The app starts the endpoint again, for the local network only.
    expect(pairing.disable).not.toHaveBeenCalled();
    expect(pairing.enable).toHaveBeenLastCalledWith(null);
  });

  it("leaves pairing off when the relay changes while it is off", async () => {
    create();

    config$.next({ remote: { relay: "off" } });
    await settled();

    expect(pairing.enable).not.toHaveBeenCalled();
  });

  it("hands on the invitation the app offers, and none where it offers none", async () => {
    pairing.state.mockResolvedValue(stateOf({ invitation: "abc" }));
    create();
    await settled();
    expect(states.at(-1)).toMatchObject({ invitation: "abc" });

    pairing.state.mockResolvedValue(stateOf());
    changed();
    await settled();
    expect(states.at(-1)).toMatchObject({ invitation: undefined });
  });

  it("shows a failure to switch pairing on until it is switched off", async () => {
    create();
    await settled();

    pairing.enable.mockRejectedValue(new HostError("internal", "Could not bind"));
    await expect(service.enable()).resolves.toBeUndefined();
    expect(states.at(-1)).toEqual({ available: false, reason: "Could not bind" });

    await service.disable();
    expect(states.at(-1)).toMatchObject({ available: true });
  });

  it("pairs with a machine nearby, handing the check number and the user's answer on", async () => {
    create();
    pairing.pair.mockImplementation(async (_id: string, onRequest) => {
      onRequest({ id: 7, name: "laptop", check: "123456" });
      return { name: "laptop", endpointId: "abc" };
    });
    const checks: string[] = [];

    const paired = service.pair("abc", (check) => {
      checks.push(check.check);
      check.answer(true);
    });

    await expect(paired).resolves.toBe("laptop");
    expect(checks).toEqual(["123456"]);
    expect(pairing.answer).toHaveBeenCalledWith(7, true);
  });

  it("opens and closes pairing", async () => {
    create();

    await service.setOpen(true);

    expect(pairing.setOpen).toHaveBeenCalledWith(true);
  });
});
