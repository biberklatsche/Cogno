import { HostError } from "@cogno/platform";
import { HostConnectionContract, HostInfo, Hosts } from "@cogno/platform/hosts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isWorthRetrying, RemoteHostConnection, RemoteHostsService } from "./remote-hosts.service";

describe("RemoteHostsService", () => {
  /** What the app says of its connections. */
  let app: Record<string, HostConnectionContract>;
  let connect: ReturnType<typeof vi.fn>;
  let hangUp: ReturnType<typeof vi.fn>;
  let changed: () => void;
  let service: RemoteHostsService;
  let seen: ReadonlyMap<string, RemoteHostConnection>;

  const settled = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(async () => {
    app = {};
    connect = vi.fn();
    hangUp = vi.fn().mockResolvedValue(undefined);
    const hosts = {
      connect,
      disconnect: hangUp,
      connections: vi.fn(() => Promise.resolve({ ...app })),
      onConnectionsChanged: vi.fn((listener) => {
        changed = listener;
        return Promise.resolve(() => undefined);
      }),
    } as unknown as Hosts;
    service = new RemoteHostsService(hosts, { onDestroy: vi.fn() } as never);
    service.connections$.subscribe((connections) => (seen = connections));
    await settled();
  });

  it("knows at its start what the app is connected to, from whichever window", async () => {
    app = { mac: { status: "connected", os: "macos" } };
    const late = new RemoteHostsService(
      {
        connections: () => Promise.resolve(app),
        onConnectionsChanged: () => Promise.resolve(() => undefined),
      } as unknown as Hosts,
      { onDestroy: vi.fn() } as never,
    );
    await settled();

    expect(late.info("mac")).toEqual({ os: "macos" });
  });

  it("follows what the app says: connecting, connected, lost, hung up", async () => {
    expect(seen.get("mac")).toBeUndefined();

    app = { mac: { status: "connecting" } };
    changed();
    await settled();
    expect(seen.get("mac")).toEqual({ status: "connecting" });
    expect(service.info("mac")).toBeUndefined();

    app = { mac: { status: "connected", os: "macos" } };
    changed();
    await settled();
    expect(service.info("mac")).toEqual({ os: "macos" });

    const failure = { code: "connectionLost", message: "The connection to the host is lost" };
    app = { mac: { status: "failed", failure } as HostConnectionContract };
    changed();
    await settled();
    expect(seen.get("mac")).toEqual({ status: "failed", failure });
    expect(service.info("mac")).toBeUndefined();

    app = {};
    changed();
    await settled();
    expect(seen.get("mac")).toBeUndefined();
  });

  it("knows a machine as connected once connecting returned", async () => {
    connect.mockImplementation(() => {
      app = { box: { status: "connected", os: "linux" } };
      return Promise.resolve({ os: "linux" } satisfies HostInfo);
    });

    await expect(service.connect("box")).resolves.toEqual({ os: "linux" });

    expect(connect).toHaveBeenCalledWith("box");
    // Without waiting for the app's word of the change.
    expect(service.info("box")).toEqual({ os: "linux" });
  });

  it("fails with the app's code and reason, and says so", async () => {
    const failure = { code: "noCognoThere", message: "No Cogno host answered" } as const;
    connect.mockImplementation(() => {
      app = { mac: { status: "failed", failure } };
      return Promise.reject(new HostError(failure.code, failure.message));
    });

    const failed = service.connect("mac");

    await expect(failed).rejects.toBeInstanceOf(HostError);
    await expect(failed).rejects.toMatchObject(failure);
    expect(seen.get("mac")).toEqual({ status: "failed", failure });
  });

  it("knows a machine as hung up on once hanging up returned", async () => {
    app = { mac: { status: "connected", os: "macos" } };
    changed();
    await settled();
    hangUp.mockImplementation(() => {
      app = {};
      return Promise.resolve();
    });

    await service.disconnect("mac");

    expect(hangUp).toHaveBeenCalledWith("mac");
    expect(service.info("mac")).toBeUndefined();
  });

  it("calls a failure worth retrying unless the machine has to be paired first", () => {
    expect(isWorthRetrying({ code: "connectFailed", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "noCognoThere", message: "" })).toBe(true);
    // Once the older Cogno is updated, connecting again works.
    expect(isWorthRetrying({ code: "hostTooOld", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "notPaired", message: "" })).toBe(false);
  });
});
