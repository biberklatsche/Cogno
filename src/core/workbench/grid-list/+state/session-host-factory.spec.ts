import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { RemoteHostsService } from "@cogno/core/workbench/remote/remote-hosts.service";
import { OsPlatform } from "@cogno/platform";
import { HostInfo } from "@cogno/platform/hosts";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pane } from "../+model/model";
import { SessionHostFactory } from "./session-host-factory";

/**
 * A pane that shows a shell of another machine, before a session exists.
 * (What happens once one does is the session's own tests'.)
 */
describe("SessionHostFactory, waiting for a host", () => {
  const pane = { terminalId: "t1", shellName: "zsh", host: "mac" } as Pane;
  let connect: ReturnType<typeof vi.fn>;
  let profileLookups: ReturnType<typeof vi.fn>;
  let factory: SessionHostFactory;

  beforeEach(() => {
    connect = vi.fn();
    profileLookups = vi.fn(() => ({ shell_type: "ZSH", path: "/bin/zsh" }));
    const remoteHosts = {
      // Never connected in these tests: no session is ever built.
      info: () => undefined,
      connect,
    } as unknown as RemoteHostsService;
    factory = new SessionHostFactory(
      {} as never,
      {} as never,
      { getShellProfileOrDefault: profileLookups } as unknown as ConfigService,
      { publish: vi.fn(), on$: () => new Subject() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      remoteHosts,
      { take: () => undefined, isFresh: () => true } as never,
      { onDestroy: vi.fn() } as never,
    );
  });

  it("starts no session and connects once, however often the pane is asked for", () => {
    connect.mockReturnValue(new Promise(() => undefined));

    expect(factory.ensureSession(pane)).toBeUndefined();
    expect(factory.ensureSession(pane)).toBeUndefined();

    expect(connect).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledWith("mac");
    expect(factory.getSessionHost("t1")).toBeUndefined();
  });

  it("looks at the pane again once the connection stands", async () => {
    let finish!: (info: HostInfo) => void;
    connect.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    connect.mockReturnValue(new Promise(() => undefined));
    factory.ensureSession(pane);

    finish({ os: "macos" });
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
  });

  it("starts nothing for a pane that was closed while its host connected", async () => {
    let finish!: (info: HostInfo) => void;
    connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    factory.ensureSession(pane);
    const lookupsBeforeClose = profileLookups.mock.calls.length;

    factory.destroy("t1");
    finish({ os: "macos" });
    await Promise.resolve();
    await Promise.resolve();

    expect(profileLookups).toHaveBeenCalledTimes(lookupsBeforeClose);
    expect(connect).toHaveBeenCalledOnce();
  });

  /** The factory's inner state, where only a pane's view could reach it. */
  type Inner = { waiting: Map<string, unknown> };

  function connectedTo(runningSessions: object) {
    const connected = new SessionHostFactory(
      {} as never,
      {} as never,
      { getShellProfileOrDefault: profileLookups } as unknown as ConfigService,
      { publish: vi.fn(), on$: () => new Subject() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      { info: () => ({ os: "windows" }), connect } as unknown as RemoteHostsService,
      runningSessions as never,
      { onDestroy: vi.fn() } as never,
    );
    return { connected, inner: connected as unknown as Inner };
  }

  it("says that the shell is gone, and starts none in its place", () => {
    const { connected, inner } = connectedTo({ take: () => undefined, isFresh: () => true });

    expect(connected.ensureSession(pane)).toBeUndefined();

    expect(connected.getSessionHost("t1")).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
    expect(inner.waiting.get("t1")).toMatchObject({ host: "mac", state: { status: "failed" } });
  });

  it("asks a host that connected long ago what runs there now, before it gives up", async () => {
    let fresh = false;
    const refresh = vi.fn(async () => {
      fresh = true;
    });
    const { connected, inner } = connectedTo({
      take: () => undefined,
      isFresh: () => fresh,
      refresh,
    });

    expect(connected.ensureSession(pane)).toBeUndefined();
    expect(inner.waiting.get("t1")).toMatchObject({ state: { status: "connecting" } });
    await Promise.resolve();
    await Promise.resolve();

    // Asked once, and the answer stands: the shell does not run there.
    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith("mac");
    expect(inner.waiting.get("t1")).toMatchObject({ state: { status: "failed" } });
  });

  it("keeps a pane whose host could not be connected, without a session", async () => {
    connect.mockRejectedValue(new Error("Permission denied (publickey)."));

    factory.ensureSession(pane);
    await Promise.resolve();
    await Promise.resolve();

    // Still waiting: asking again does not connect behind the user's back.
    expect(factory.ensureSession(pane)).toBeUndefined();
    expect(connect).toHaveBeenCalledOnce();
  });
});
