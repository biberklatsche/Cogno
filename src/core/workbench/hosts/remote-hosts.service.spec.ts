import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { HostError } from "@cogno/platform";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectError,
  isWorthRetrying,
  RemoteHostConnection,
  RemoteHostsService,
} from "./remote-hosts.service";

describe("RemoteHostsService", () => {
  let connect: ReturnType<typeof vi.fn>;
  let hangUp: ReturnType<typeof vi.fn>;
  let disconnected: (id: string, lost: boolean) => void;
  let service: RemoteHostsService;

  beforeEach(() => {
    connect = vi.fn();
    hangUp = vi.fn().mockResolvedValue(undefined);
    const hosts = {
      connect,
      disconnect: hangUp,
      onDisconnected: vi.fn((listener) => {
        disconnected = listener;
        return Promise.resolve(() => undefined);
      }),
    } as unknown as Hosts;
    service = new RemoteHostsService(
      hosts,
      { nameOf: (id: string) => (id === "mac" ? "MacBook" : undefined) } as never,
      { onDestroy: vi.fn() } as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("connects a paired machine and remembers what it said", async () => {
    connect.mockResolvedValue({ os: "linux" } satisfies HostInfo);

    expect(service.info("box")).toBeUndefined();
    await expect(service.connect("box")).resolves.toEqual({ os: "linux" });

    expect(connect).toHaveBeenCalledWith("box");
    expect(service.info("box")).toEqual({ os: "linux" });
  });

  it("sets a connection up once, however many panes ask for it", async () => {
    let finish!: (info: HostInfo) => void;
    connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = service.connect("mac");
    const second = service.connect("mac");
    finish({ os: "macos" });
    await Promise.all([first, second]);
    await service.connect("mac");

    expect(connect).toHaveBeenCalledOnce();
  });

  it("fails with the backend's code and reason and can be tried again", async () => {
    connect.mockRejectedValueOnce(new HostError("noCognoThere", "No Cogno host answered"));

    const failed = service.connect("mac");
    await expect(failed).rejects.toBeInstanceOf(ConnectError);
    await expect(failed).rejects.toMatchObject({
      failure: { code: "noCognoThere", message: "No Cogno host answered" },
    });
    expect(service.info("mac")).toBeUndefined();

    connect.mockResolvedValue({ os: "macos" });
    await expect(service.connect("mac")).resolves.toEqual({ os: "macos" });
  });

  it("takes a machine that is not paired as nothing worth retrying", async () => {
    connect.mockRejectedValueOnce(new HostError("notPaired", "Not paired with nowhere"));
    const refused = service.connect("nowhere");

    await expect(refused).rejects.toMatchObject({ failure: { code: "notPaired" } });
    const { failure } = (await refused.catch((error: ConnectError) => error)) as ConnectError;
    expect(isWorthRetrying(failure)).toBe(false);
  });

  it("calls a failure worth retrying unless the machine has to be paired first", () => {
    expect(isWorthRetrying({ code: "connectFailed", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "noCognoThere", message: "" })).toBe(true);
    // Once the older Cogno is updated, connecting again works.
    expect(isWorthRetrying({ code: "hostTooOld", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "notPaired", message: "" })).toBe(false);
  });

  it("forgets a lost connection and tells the user, in the window that used it", async () => {
    const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
    connect.mockResolvedValue({ os: "macos" });
    await service.connect("mac");

    // Another window's host: nothing of this window ended.
    disconnected("box", true);
    expect(warned).not.toHaveBeenCalled();

    disconnected("mac", true);
    expect(service.info("mac")).toBeUndefined();
    // By the name the user knows the machine by.
    expect(warned).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("MacBook"), notify: true }),
    );
  });

  it("forgets a connection another window hung up on, without calling it a loss", async () => {
    const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
    connect.mockResolvedValue({ os: "macos" });
    await service.connect("mac");

    disconnected("mac", false);

    expect(service.info("mac")).toBeUndefined();
    expect(warned).not.toHaveBeenCalled();
  });

  describe("how far a connection is", () => {
    let seen: ReadonlyMap<string, RemoteHostConnection>;

    beforeEach(() => {
      service.connections$.subscribe((connections) => (seen = connections));
    });

    it("says connecting, then connected", async () => {
      let finish!: (info: HostInfo) => void;
      connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      expect(seen.get("mac")).toBeUndefined();

      const connecting = service.connect("mac");
      expect(seen.get("mac")).toEqual({ status: "connecting" });

      finish({ os: "macos" });
      await connecting;
      expect(seen.get("mac")).toEqual({
        status: "connected",
        info: { os: "macos" },
      });
    });

    it("says why a connection failed", async () => {
      connect.mockRejectedValueOnce(new HostError("connectFailed", "Could not reach mac."));
      await expect(service.connect("mac")).rejects.toThrow();
      expect(seen.get("mac")).toEqual({
        status: "failed",
        failure: { code: "connectFailed", message: "Could not reach mac." },
      });
    });

    it("hangs up when asked, without calling it a loss", async () => {
      connect.mockResolvedValue({ os: "macos" });
      await service.connect("mac");
      const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);

      await service.disconnect("mac");
      // The backend says so too, as for every connection that ends.
      disconnected("mac", true);

      expect(hangUp).toHaveBeenCalledWith("mac");
      expect(service.info("mac")).toBeUndefined();
      expect(seen.get("mac")).toBeUndefined();
      expect(warned).not.toHaveBeenCalled();
    });

    it("stays hung up when the connection it hung up on comes through after all", async () => {
      let finish!: (info: HostInfo) => void;
      connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const connecting = service.connect("mac");

      await service.disconnect("mac");
      finish({ os: "macos" });

      await expect(connecting).rejects.toThrow("hung up");
      expect(service.info("mac")).toBeUndefined();
      expect(seen.get("mac")).toBeUndefined();
    });

    it("forgets a connection that was lost", async () => {
      connect.mockResolvedValue({ os: "macos" });
      await service.connect("mac");
      vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);

      disconnected("mac", true);

      expect(seen.get("mac")).toBeUndefined();
    });
  });
});
