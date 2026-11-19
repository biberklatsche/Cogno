import { ProcessPromptHandler } from "@cogno/core/api/command-runner-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { PairingService } from "@cogno/core/workbench/hosts/pairing.service";
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
  let disconnected: (name: string) => void;
  let register: ReturnType<typeof vi.fn>;
  let forgetPrompts: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;
  let updateConfig: ReturnType<typeof vi.fn>;
  let connectPaired: ReturnType<typeof vi.fn>;
  let pairing: { pairedNames: string[]; isKnown: boolean; known: Promise<void> };
  let service: RemoteHostsService;

  beforeEach(() => {
    connect = vi.fn();
    hangUp = vi.fn().mockResolvedValue(undefined);
    forgetPrompts = vi.fn();
    register = vi.fn().mockReturnValue(forgetPrompts);
    ask = vi.fn().mockResolvedValue("secret");
    updateConfig = vi.fn().mockResolvedValue(undefined);
    connectPaired = vi.fn();
    pairing = { pairedNames: ["laptop"], isKnown: true, known: Promise.resolve() };
    const hosts = {
      connect,
      connectPaired,
      disconnect: hangUp,
      onDisconnected: vi.fn((listener) => {
        disconnected = listener;
        return Promise.resolve(() => undefined);
      }),
    } as unknown as Hosts;
    const config = {
      update: updateConfig,
      config: {
        remote: {
          hosts: {
            mac: { destination: "lars@macbook" },
            box: { destination: "box", command: "/opt/cogno server --stdio" },
          },
        },
      },
    } as unknown as ConfigService;
    service = new RemoteHostsService(
      hosts,
      config,
      { register } as unknown as ProcessPromptDispatcher,
      { ask } as unknown as ProcessPromptService,
      pairing as unknown as PairingService,
      { onDestroy: vi.fn() } as never,
    );
  });

  it("waits for the paired machines to be known before it connects one", async () => {
    pairing.isKnown = false;
    let known!: () => void;
    pairing.known = new Promise((resolve) => (known = resolve));
    connectPaired.mockResolvedValue({ os: "macos", foundCommand: null } satisfies HostInfo);

    const connecting = service.connect("laptop");
    expect(connectPaired).not.toHaveBeenCalled();
    pairing.isKnown = true;
    known();

    await expect(connecting).resolves.toMatchObject({ os: "macos" });
    expect(connectPaired).toHaveBeenCalledWith("laptop");
  });

  it("connects a paired machine without ssh and asks nothing", async () => {
    connectPaired.mockResolvedValue({ os: "macos", foundCommand: null } satisfies HostInfo);

    const info = await service.connect("laptop");

    expect(info.os).toBe("macos");
    expect(connectPaired).toHaveBeenCalledWith("laptop");
    expect(connect).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it("calls a machine that is no longer paired nothing to retry", () => {
    expect(isWorthRetrying({ code: "notPaired", message: "" })).toBe(false);
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps the command that reached Cogno when the remote names none", async () => {
    const forPowerShell = '& ".cogno/bin/cogno" server --stdio';
    connect.mockResolvedValue({ os: "windows", foundCommand: forPowerShell } satisfies HostInfo);

    await service.connect("mac");

    expect(updateConfig).toHaveBeenCalledWith({ "remote.hosts.mac.command": forPowerShell });
  });

  it("connects with the host's destination and command and remembers what it said", async () => {
    connect.mockResolvedValue({ os: "linux", foundCommand: null } satisfies HostInfo);

    expect(service.info("box")).toBeUndefined();
    await expect(service.connect("box")).resolves.toEqual({ os: "linux", foundCommand: null });

    expect(connect).toHaveBeenCalledWith(
      "box",
      "box",
      "/opt/cogno server --stdio",
      expect.any(String),
    );
    expect(service.info("box")).toEqual({ os: "linux", foundCommand: null });
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("sets a connection up once, however many panes ask for it", async () => {
    let finish!: (info: HostInfo) => void;
    connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = service.connect("mac");
    const second = service.connect("mac");
    finish({ os: "macos", foundCommand: null });
    await Promise.all([first, second]);
    await service.connect("mac");

    expect(connect).toHaveBeenCalledOnce();
  });

  it("shows what ssh asks while connecting, and only then", async () => {
    let finish!: (info: HostInfo) => void;
    connect.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const connecting = service.connect("mac");
    // The session the backend was given is the one the dialog answers.
    const [promptSession, handler] = register.mock.calls[0] as [string, ProcessPromptHandler];
    expect(connect.mock.calls[0]?.[3]).toBe(promptSession);
    const prompt = { text: "Password:", closed: new AbortController().signal };
    await expect(handler(prompt)).resolves.toBe("secret");
    expect(ask).toHaveBeenCalledWith(prompt);
    expect(forgetPrompts).not.toHaveBeenCalled();

    finish({ os: "macos", foundCommand: null });
    await connecting;
    expect(forgetPrompts).toHaveBeenCalledOnce();
  });

  it("fails with the backend's code and reason and can be tried again", async () => {
    connect.mockRejectedValueOnce(new HostError("noCognoThere", "No Cogno host answered"));

    const failed = service.connect("mac");
    await expect(failed).rejects.toBeInstanceOf(ConnectError);
    await expect(failed).rejects.toMatchObject({
      failure: { code: "noCognoThere", message: "No Cogno host answered" },
    });
    expect(service.info("mac")).toBeUndefined();
    expect(forgetPrompts).toHaveBeenCalledOnce();

    connect.mockResolvedValue({ os: "macos", foundCommand: null });
    await expect(service.connect("mac")).resolves.toEqual({ os: "macos", foundCommand: null });
  });

  it("refuses a host the config does not define, as nothing worth retrying", async () => {
    const refused = service.connect("nowhere");

    await expect(refused).rejects.toMatchObject({ failure: { code: "notConfigured" } });
    expect(connect).not.toHaveBeenCalled();
    const { failure } = (await refused.catch((error: ConnectError) => error)) as ConnectError;
    expect(isWorthRetrying(failure)).toBe(false);
  });

  it("calls a failure worth retrying unless the settings have to change first", () => {
    expect(isWorthRetrying({ code: "connectFailed", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "noCognoThere", message: "" })).toBe(true);
    // Once the older Cogno is updated, connecting again works.
    expect(isWorthRetrying({ code: "hostTooOld", message: "" })).toBe(true);
    expect(isWorthRetrying({ code: "invalidDestination", message: "" })).toBe(false);
    expect(isWorthRetrying({ code: "notConfigured", message: "" })).toBe(false);
  });

  it("forgets a lost connection and tells the user, in the window that used it", async () => {
    const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
    connect.mockResolvedValue({ os: "macos", foundCommand: null });
    await service.connect("mac");

    // Another window's host: nothing of this window ended.
    disconnected("box");
    expect(warned).not.toHaveBeenCalled();

    disconnected("mac");
    expect(service.info("mac")).toBeUndefined();
    expect(warned).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("mac"), notify: true }),
    );
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

      finish({ os: "macos", foundCommand: null });
      await connecting;
      expect(seen.get("mac")).toEqual({
        status: "connected",
        info: { os: "macos", foundCommand: null },
      });
    });

    it("says why a connection failed", async () => {
      connect.mockRejectedValueOnce(
        new HostError("connectFailed", "Permission denied (publickey)."),
      );
      await expect(service.connect("mac")).rejects.toThrow();
      expect(seen.get("mac")).toEqual({
        status: "failed",
        failure: { code: "connectFailed", message: "Permission denied (publickey)." },
      });
    });

    it("hangs up when asked, without calling it a loss", async () => {
      connect.mockResolvedValue({ os: "macos", foundCommand: null });
      await service.connect("mac");
      const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);

      await service.disconnect("mac");
      // The backend says so too, as for every connection that ends.
      disconnected("mac");

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
      finish({ os: "macos", foundCommand: null });

      await expect(connecting).rejects.toThrow("hung up");
      expect(service.info("mac")).toBeUndefined();
      expect(seen.get("mac")).toBeUndefined();
    });

    it("forgets a connection that was lost", async () => {
      connect.mockResolvedValue({ os: "macos", foundCommand: null });
      await service.connect("mac");
      vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);

      disconnected("mac");

      expect(seen.get("mac")).toBeUndefined();
    });
  });
});
