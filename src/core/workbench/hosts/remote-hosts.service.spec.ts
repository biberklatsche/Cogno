import { HostConnectionContract, Hosts } from "@cogno/platform/hosts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isWorthRetrying, RemoteHostsService } from "./remote-hosts.service";

describe("RemoteHostsService", () => {
  /** What the app says of its connections. */
  let app: Record<string, HostConnectionContract>;
  let connect: ReturnType<typeof vi.fn>;
  let hangUp: ReturnType<typeof vi.fn>;
  let changed: () => void;
  let service: RemoteHostsService;
  let seen: ReadonlyMap<string, HostConnectionContract>;

  const settled = () => new Promise((resolve) => setTimeout(resolve));

  function create(): RemoteHostsService {
    const hosts = {
      connect,
      disconnect: hangUp,
      connections: vi.fn(() => Promise.resolve({ ...app })),
      onConnectionsChanged: vi.fn((listener) => {
        changed = listener;
        return Promise.resolve(() => undefined);
      }),
    } as unknown as Hosts;
    return new RemoteHostsService(hosts, { onDestroy: vi.fn() } as never);
  }

  beforeEach(() => {
    app = {};
    connect = vi.fn().mockResolvedValue({ os: "linux" });
    hangUp = vi.fn().mockResolvedValue(undefined);
  });

  it("knows at its start what the app is connected to, from whichever window", async () => {
    app = { mac: { status: "connected" } };
    service = create();
    service.connections$.subscribe((connections) => (seen = connections));
    await settled();

    expect(seen.get("mac")).toEqual({ status: "connected" });
  });

  it("follows what the app says: connecting, connected, lost, hung up", async () => {
    service = create();
    service.connections$.subscribe((connections) => (seen = connections));
    await settled();
    expect(seen.get("mac")).toBeUndefined();

    const failure = { code: "connectionLost", message: "The connection to the host is lost" };
    const said: Record<string, HostConnectionContract>[] = [
      { mac: { status: "connecting" } },
      { mac: { status: "connected" } },
      { mac: { status: "failed", failure } as HostConnectionContract },
      {},
    ];
    for (const next of said) {
      app = next;
      changed();
      await settled();
      expect(seen.get("mac")).toEqual(next["mac"]);
    }
  });

  it("asks the app to connect and to hang up, and keeps nothing of its own", async () => {
    service = create();
    service.connections$.subscribe((connections) => (seen = connections));

    await expect(service.connect("box")).resolves.toEqual({ os: "linux" });
    await service.disconnect("box");
    await settled();

    expect(connect).toHaveBeenCalledWith("box");
    expect(hangUp).toHaveBeenCalledWith("box");
    // The app said nothing of a connection: none is shown.
    expect(seen.size).toBe(0);
  });

  it("calls a failure worth retrying unless the machine has to be paired first", () => {
    expect(isWorthRetrying({ code: "connectFailed", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "noCognoThere", message: "" })).toBe(true);
    // Once the older Cogno is updated, connecting again works.
    expect(isWorthRetrying({ code: "hostTooOld", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "notPaired", message: "" })).toBe(false);
  });
});
