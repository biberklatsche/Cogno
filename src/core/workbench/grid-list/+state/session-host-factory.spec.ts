import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { RemoteHostsService } from "@cogno/core/workbench/remote/remote-hosts.service";
import { OsPlatform } from "@cogno/platform";
import { HostInfo } from "@cogno/platform/hosts";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pane } from "../+model/model";
import { SessionHostFactory } from "./session-host-factory";

/**
 * A pane whose shell runs on another machine, before that machine is
 * connected. (What happens once a session exists is the session's own tests'.)
 */
describe("SessionHostFactory, waiting for a host", () => {
  const pane = { terminalId: "t1", shellName: "mac-zsh" } as Pane;
  let connect: ReturnType<typeof vi.fn>;
  let profileLookups: ReturnType<typeof vi.fn>;
  let factory: SessionHostFactory;

  beforeEach(() => {
    connect = vi.fn();
    profileLookups = vi.fn(() => ({ shell_type: "ZSH", path: "/bin/zsh", host: "mac" }));
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
      { take: () => undefined, unclaimed: () => [], isFresh: () => true } as never,
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

  it("asks instead of starting a shell when shells already run on the host", () => {
    const sessions = [{ terminalId: "office-1" }, { terminalId: "office-2" }];
    const connected = new SessionHostFactory(
      {} as never,
      {} as never,
      { getShellProfileOrDefault: profileLookups } as unknown as ConfigService,
      { publish: vi.fn(), on$: () => new Subject() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      { info: () => ({ os: "windows" }), connect } as unknown as RemoteHostsService,
      // The pane's own terminal is not among them: it is a new tab.
      { take: () => undefined, unclaimed: () => sessions, isFresh: () => true } as never,
      { onDestroy: vi.fn() } as never,
    );

    // No session, and nothing to connect: the pane waits for the answer.
    expect(connected.ensureSession(pane)).toBeUndefined();
    expect(connected.getSessionHost("t1")).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  /** The factory's inner state, where only a pane's view could reach it. */
  type Inner = {
    sessions: Map<string, unknown>;
    waiting: Map<string, unknown>;
    goOnWithSessions(terminalId: string, waiting: unknown): void;
  };

  function connectedTo(sessions: { terminalId: string }[], publish = vi.fn()) {
    const connected = new SessionHostFactory(
      {} as never,
      {} as never,
      { getShellProfileOrDefault: profileLookups } as unknown as ConfigService,
      { publish, on$: () => new Subject() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      { info: () => ({ os: "windows" }), connect } as unknown as RemoteHostsService,
      { take: () => undefined, unclaimed: () => sessions, isFresh: () => true } as never,
      { onDestroy: vi.fn() } as never,
    );
    return { connected, inner: connected as unknown as Inner, publish };
  }

  it("opens a tab for every shell the user goes on with, and closes the one that asked", () => {
    const { connected, inner, publish } = connectedTo([
      { terminalId: "office-1" },
      { terminalId: "office-2" },
    ]);
    connected.ensureSession(pane);

    inner.goOnWithSessions("t1", inner.waiting.get("t1"));

    const created = publish.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "CreateTab")
      .map((message) => message.payload);
    expect(created).toEqual([
      expect.objectContaining({ terminalId: "office-1", shellName: "mac-zsh", isActive: true }),
      expect.objectContaining({ terminalId: "office-2", shellName: "mac-zsh", isActive: false }),
    ]);
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "ActionFired", terminalId: "t1" }),
    );
  });

  it("asks a host that connected long ago what runs there now, before a new tab decides", async () => {
    let fresh = false;
    const sessions: { terminalId: string }[] = [];
    const refresh = vi.fn(async () => {
      // A shell was started there since the host connected.
      sessions.push({ terminalId: "office-9" });
      fresh = true;
    });
    const connected = new SessionHostFactory(
      {} as never,
      {} as never,
      { getShellProfileOrDefault: profileLookups } as unknown as ConfigService,
      { publish: vi.fn(), on$: () => new Subject() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      { info: () => ({ os: "windows" }), connect } as unknown as RemoteHostsService,
      {
        take: () => undefined,
        unclaimed: () => sessions,
        isFresh: () => fresh,
        refresh,
      } as never,
      { onDestroy: vi.fn() } as never,
    );
    const inner = connected as unknown as Inner;

    expect(connected.ensureSession(pane)).toBeUndefined();
    expect(refresh).toHaveBeenCalledWith("mac");
    await Promise.resolve();
    await Promise.resolve();

    // Asked once, and the answer is offered: the pane still waits, now for
    // the user.
    expect(refresh).toHaveBeenCalledOnce();
    expect(inner.waiting.get("t1")).toMatchObject({ state: { status: "sessions", count: 1 } });
  });

  it("does not offer a shell this window shows already", () => {
    // The host is this very machine, reached through ssh: its one shell is
    // the one a pane here shows.
    const { connected, inner } = connectedTo([{ terminalId: "shown-here" }]);
    inner.sessions.set("shown-here", {});

    // Nothing to ask about: the pane goes straight on to its own session
    // (which this test's empty injector cannot build).
    expect(() => connected.ensureSession(pane)).toThrow();
    expect(inner.waiting.has("t1")).toBe(false);
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
