import type { PairingState } from "@cogno/core/api/pairing-port";
import { HostError, type Pairing, type PairingStateContract } from "@cogno/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PairingService } from "./pairing.service";

const NOT_SET_UP = new HostError("pairingUnreachable", "Cogno's pairing server is not set up yet");

function stateOf(overrides: Partial<PairingStateContract> = {}): PairingStateContract {
  return { accepting: true, machines: [], code: null, ...overrides };
}

/** Lets what was answered arrive. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("PairingService", () => {
  let changed: () => void;
  let pairing: { [K in "state" | "enable" | "disable" | "pair"]: ReturnType<typeof vi.fn> };
  let service: PairingService;
  let states: PairingState[];

  function create(): void {
    service = new PairingService(
      {
        ...pairing,
        onChanged: vi.fn((listener) => {
          changed = listener;
          return Promise.resolve(() => undefined);
        }),
      } as unknown as Pairing,
      { config: { remote: { hosts: { office: { destination: "lars@office" } } } } } as never,
      { onDestroy: vi.fn() } as never,
    );
    states = [];
    service.state$.subscribe((state) => states.push(state));
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    pairing = {
      state: vi.fn().mockResolvedValue(stateOf()),
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
      pair: vi.fn().mockResolvedValue({ name: "laptop", endpointId: "abc" }),
    };
  });

  afterEach(() => vi.useRealTimers());

  it("says nothing until pairing answered, then reads again whenever it changed", async () => {
    create();
    expect(states).toEqual([]);

    await settled();
    expect(states.at(-1)).toEqual({ available: true, accepting: true, code: undefined });

    pairing.state.mockResolvedValue(
      stateOf({
        machines: [{ name: "laptop", endpointId: "abc" }],
        code: { code: "K7Q4MX", expiresInSecs: 300 },
      }),
    );
    changed();
    await settled();

    expect(states.at(-1)).toEqual({
      available: true,
      accepting: true,
      code: { code: "K7Q4MX", expiresAt: 1_000_000 + 300_000 },
    });
    expect(service.pairedNames).toEqual(["laptop"]);
    expect(service.remoteNames()).toEqual(["office", "laptop"]);
  });

  it("says why pairing does not work, and knows no paired machines then", async () => {
    pairing.state.mockRejectedValue(NOT_SET_UP);
    create();
    await settled();

    expect(states.at(-1)).toEqual({
      available: false,
      reason: "Cogno's pairing server is not set up yet",
    });
    expect(service.pairedNames).toEqual([]);
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

    expect(service.pairedNames).toEqual(["new"]);
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

  it("pairs by code under a name no remote has", async () => {
    create();
    pairing.state.mockResolvedValue(stateOf({ machines: [{ name: "laptop", endpointId: "a" }] }));
    changed();
    await settled();
    const onCheck = vi.fn();

    await expect(service.pairByCode("K7Q-4MX", onCheck)).resolves.toBe("laptop");

    expect(pairing.pair).toHaveBeenCalledWith("K7Q-4MX", ["office", "laptop"], onCheck);
  });
});
