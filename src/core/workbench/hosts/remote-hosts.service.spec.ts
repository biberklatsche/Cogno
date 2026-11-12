import { ProcessPromptHandler } from "@cogno/core/api/command-runner-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteHostConnection, RemoteHostsService } from "./remote-hosts.service";

describe("RemoteHostsService", () => {
  let connect: ReturnType<typeof vi.fn>;
  let hangUp: ReturnType<typeof vi.fn>;
  let disconnected: (name: string) => void;
  let register: ReturnType<typeof vi.fn>;
  let forgetPrompts: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;
  let refreshRunning: ReturnType<typeof vi.fn>;
  let service: RemoteHostsService;

  beforeEach(() => {
    connect = vi.fn();
    hangUp = vi.fn().mockResolvedValue(undefined);
    forgetPrompts = vi.fn();
    register = vi.fn().mockReturnValue(forgetPrompts);
    ask = vi.fn().mockResolvedValue("secret");
    refreshRunning = vi.fn().mockResolvedValue(undefined);
    const hosts = {
      connect,
      disconnect: hangUp,
      onDisconnected: vi.fn((listener) => {
        disconnected = listener;
        return Promise.resolve(() => undefined);
      }),
    } as unknown as Hosts;
    const config = {
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
      { refresh: refreshRunning } as never,
      { onDestroy: vi.fn() } as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("connects with the host's destination and command and remembers what it said", async () => {
    connect.mockResolvedValue({ os: "linux" } satisfies HostInfo);

    expect(service.info("box")).toBeUndefined();
    await expect(service.connect("box")).resolves.toEqual({ os: "linux" });

    expect(connect).toHaveBeenCalledWith(
      "box",
      "box",
      "/opt/cogno server --stdio",
      expect.any(String),
    );
    expect(service.info("box")).toEqual({ os: "linux" });
  });

  it("knows what runs on a host before it counts as connected", async () => {
    connect.mockResolvedValue({ os: "macos" });
    let answered!: () => void;
    refreshRunning.mockReturnValue(new Promise<void>((resolve) => (answered = resolve)));

    const connecting = service.connect("mac");
    await vi.waitFor(() => expect(refreshRunning).toHaveBeenCalledWith("mac"));
    // A pane must find its shell among what the host said.
    expect(service.info("mac")).toBeUndefined();

    answered();
    await connecting;
    expect(service.info("mac")).toEqual({ os: "macos" });
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

    finish({ os: "macos" });
    await connecting;
    expect(forgetPrompts).toHaveBeenCalledOnce();
  });

  it("fails with the backend's reason and can be tried again", async () => {
    connect.mockRejectedValueOnce("No Cogno answered on the other machine");

    await expect(service.connect("mac")).rejects.toThrow("No Cogno answered on the other machine");
    expect(service.info("mac")).toBeUndefined();
    expect(forgetPrompts).toHaveBeenCalledOnce();

    connect.mockResolvedValue({ os: "macos" });
    await expect(service.connect("mac")).resolves.toEqual({ os: "macos" });
  });

  it("refuses a host the config does not define", async () => {
    await expect(service.connect("nowhere")).rejects.toThrow(
      "Host 'nowhere' is not defined in remote.hosts.",
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it("forgets a lost connection and tells the user, in the window that used it", async () => {
    const warned = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
    connect.mockResolvedValue({ os: "macos" });
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

      finish({ os: "macos" });
      await connecting;
      expect(seen.get("mac")).toEqual({ status: "connected", info: { os: "macos" } });
    });

    it("says why a connection failed", async () => {
      connect.mockRejectedValueOnce("Permission denied (publickey).");
      await expect(service.connect("mac")).rejects.toThrow();
      expect(seen.get("mac")).toEqual({
        status: "failed",
        reason: "Permission denied (publickey).",
      });
    });

    it("hangs up when asked, without calling it a loss", async () => {
      connect.mockResolvedValue({ os: "macos" });
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
      finish({ os: "macos" });

      await expect(connecting).rejects.toThrow("hung up");
      expect(service.info("mac")).toBeUndefined();
      expect(seen.get("mac")).toBeUndefined();
    });

    it("forgets a connection that was lost", async () => {
      connect.mockResolvedValue({ os: "macos" });
      await service.connect("mac");
      vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);

      disconnected("mac");

      expect(seen.get("mac")).toBeUndefined();
    });
  });
});
