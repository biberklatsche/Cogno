import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { RemoteHostsService } from "@cogno/core/workbench/remote/remote-hosts.service";
import { OsPlatform } from "@cogno/platform";
import { HostInfo } from "@cogno/platform/hosts";
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
      { publish: vi.fn() } as never,
      {} as never,
      { take: vi.fn() } as never,
      { platform: () => "windows" } as unknown as OsPlatform,
      remoteHosts,
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
