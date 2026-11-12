import { ProcessPromptHandler } from "@cogno/core/api/command-runner-port";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { ProcessPromptDispatcher } from "@cogno/core/infrastructure/process-prompt/process-prompt-dispatcher";
import { ShellIntegrationWriter } from "@cogno/core/session/shells/shell-integration.writer";
import { ProcessPromptService } from "@cogno/core/workbench/external/process-prompt.service";
import { FeatureHost } from "@cogno/core/workbench/feature-host/feature-host";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteHostsService } from "./remote-hosts.service";

describe("RemoteHostsService", () => {
  let connect: ReturnType<typeof vi.fn>;
  let disconnected: (name: string) => void;
  let register: ReturnType<typeof vi.fn>;
  let forgetPrompts: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;
  let ensureIntegration: ReturnType<typeof vi.fn>;
  let refreshRunning: ReturnType<typeof vi.fn>;
  let service: RemoteHostsService;
  const shellSupport = [{ shellType: "ZSH", integrationFiles: [] }];

  beforeEach(() => {
    connect = vi.fn();
    forgetPrompts = vi.fn();
    register = vi.fn().mockReturnValue(forgetPrompts);
    ask = vi.fn().mockResolvedValue("secret");
    ensureIntegration = vi.fn().mockResolvedValue(undefined);
    refreshRunning = vi.fn().mockResolvedValue(undefined);
    const hosts = {
      connect,
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
      { ensure: ensureIntegration } as unknown as ShellIntegrationWriter,
      { getShellSupportDefinitions: () => shellSupport } as unknown as FeatureHost,
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

  it("gives the host this Cogno's shell integration before it counts as connected", async () => {
    connect.mockResolvedValue({ os: "macos" });
    let installed!: () => void;
    ensureIntegration.mockReturnValue(new Promise<void>((resolve) => (installed = resolve)));

    const connecting = service.connect("mac");
    await vi.waitFor(() => expect(ensureIntegration).toHaveBeenCalledWith(shellSupport, "mac"));
    // No shell may start there before its scripts lie there.
    expect(service.info("mac")).toBeUndefined();

    installed();
    await connecting;
    expect(service.info("mac")).toEqual({ os: "macos" });
    // And what runs there is known by then: a pane may go on with it.
    expect(refreshRunning).toHaveBeenCalledWith("mac");
  });

  it("does not count a host as connected whose shell integration could not be written", async () => {
    connect.mockResolvedValue({ os: "macos" });
    ensureIntegration.mockRejectedValue(new Error("Permission denied"));

    await expect(service.connect("mac")).rejects.toThrow("Permission denied");
    expect(service.info("mac")).toBeUndefined();
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
});
