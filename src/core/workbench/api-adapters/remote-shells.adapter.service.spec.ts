import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { RemoteHostConnection } from "@cogno/core/workbench/hosts/remote-hosts.service";
import { HostError, SessionInfoContract } from "@cogno/platform";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteShellsAdapterService } from "./remote-shells.adapter.service";

type RemoteConfig = {
  remote?: { hosts?: Record<string, { destination: string; command?: string }> };
};

describe("RemoteShellsAdapterService", () => {
  let config$: BehaviorSubject<RemoteConfig>;
  let connections$: BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>;
  let update: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let sessions: ReturnType<typeof vi.fn>;
  let killSession: ReturnType<typeof vi.fn>;
  let takeBack: ReturnType<typeof vi.fn>;
  let sessionChanges: Subject<void>;
  let sessionRuntimes: Subject<{ terminalId: string; runtime: { status: string } }>;
  let findTab: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let publish: ReturnType<typeof vi.fn>;
  let adapter: RemoteShellsAdapterService;

  beforeEach(() => {
    config$ = new BehaviorSubject<RemoteConfig>({
      remote: { hosts: { office: { destination: "lars@office" } } },
    });
    connections$ = new BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>(new Map());
    update = vi.fn().mockResolvedValue(undefined);
    disconnect = vi.fn().mockResolvedValue(undefined);
    sessions = vi.fn().mockResolvedValue([]);
    killSession = vi.fn().mockResolvedValue(undefined);
    takeBack = vi.fn().mockResolvedValue(false);
    sessionChanges = new Subject();
    sessionRuntimes = new Subject();
    findTab = vi.fn();
    navigate = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn();
    adapter = new RemoteShellsAdapterService(
      {
        config$,
        get config() {
          return config$.value;
        },
        update,
      } as never,
      { connections$, connect: vi.fn(), disconnect } as never,
      { sessions, killSession } as never,
      { takeBack } as never,
      { changes$: sessionChanges, runtimes$: sessionRuntimes } as never,
      { findTabIdByTerminalId: findTab } as never,
      { navigateToTerminal: navigate } as never,
      { publish } as never,
    );
  });

  it("lists the machines of the config with how far their connection is", () => {
    let hosts: readonly RemoteHost[] = [];
    adapter.hosts$.subscribe((next) => (hosts = next));
    expect(hosts).toEqual([
      {
        name: "office",
        destination: "lars@office",
        command: undefined,
        connection: "disconnected",
        failure: undefined,
      },
    ]);

    connections$.next(
      new Map([
        [
          "office",
          { status: "failed", failure: { code: "connectFailed", message: "No route to host" } },
        ],
      ]),
    );
    expect(hosts[0]).toMatchObject({ connection: "failed", failure: "No route to host" });

    config$.next({});
    expect(hosts).toEqual([]);
  });

  describe("saving a machine", () => {
    it("writes a new one to the config", async () => {
      await adapter.saveHost({ name: " mac ", destination: " lars@macbook ", command: "" });

      expect(update).toHaveBeenCalledWith({
        "remote.hosts.mac.destination": "lars@macbook",
        "remote.hosts.mac.command": undefined,
      });
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("rejects a name that cannot be a config key, and writes nothing", async () => {
      await expect(adapter.saveHost({ name: "my.mac", destination: "x" })).rejects.toThrow();
      await expect(adapter.saveHost({ name: "", destination: "x" })).rejects.toThrow();
      await expect(adapter.saveHost({ name: "mac", destination: " " })).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it("does not overwrite another machine of that name", async () => {
      await expect(adapter.saveHost({ name: "office", destination: "elsewhere" })).rejects.toThrow(
        "already",
      );
      await expect(
        adapter.saveHost({ name: "office", destination: "elsewhere" }, "mac"),
      ).rejects.toThrow("already");
      expect(update).not.toHaveBeenCalled();
    });

    it("takes the old name out when a machine is renamed, and hangs up on it", async () => {
      await adapter.saveHost({ name: "work", destination: "lars@office" }, "office");

      expect(update).toHaveBeenCalledWith({
        "remote.hosts.work.destination": "lars@office",
        "remote.hosts.work.command": undefined,
        "remote.hosts.office.destination": undefined,
        "remote.hosts.office.command": undefined,
      });
      expect(disconnect).toHaveBeenCalledWith("office");
    });

    it("hangs up when where it connects changed, and not otherwise", async () => {
      await adapter.saveHost({ name: "office", destination: "lars@office" }, "office");
      expect(disconnect).not.toHaveBeenCalled();

      await adapter.saveHost({ name: "office", destination: "lars@office-2" }, "office");
      expect(disconnect).toHaveBeenCalledWith("office");
    });
  });

  it("takes a machine out of the config and hangs up on it", async () => {
    await adapter.removeHost("office");

    expect(update).toHaveBeenCalledWith({
      "remote.hosts.office.destination": undefined,
      "remote.hosts.office.command": undefined,
    });
    expect(disconnect).toHaveBeenCalledWith("office");
  });

  it("says what runs on a machine, in the words of the Cogno it belongs to", async () => {
    const session: SessionInfoContract = {
      terminalId: "t1",
      placement: { workspace: "Cogno", tab: "build", title: null, directory: "C:\\dev" },
      profile: {
        shell_type: "PowerShell",
        inject_cogno_cli: true,
        enable_shell_integration: true,
        load_user_rc: true,
      },
      size: { cols: 80, rows: 24 },
      attached: { to: "elsewhere", by: "lars-laptop" },
    };
    sessions.mockResolvedValue([session]);

    await expect(adapter.shells("office")).resolves.toEqual([
      {
        terminalId: "t1",
        workspace: "Cogno",
        tab: "build",
        title: undefined,
        directory: "C:\\dev",
        shown: "elsewhere",
        shownBy: "lars-laptop",
      },
    ]);
    expect(sessions).toHaveBeenCalledWith("office");
  });

  describe("showing a shell here", () => {
    it("opens a tab for a shell no pane here shows; the pane asks for it itself", async () => {
      await adapter.show("office", "t1");

      expect(publish).toHaveBeenCalledWith({
        type: "CreateTab",
        payload: expect.objectContaining({ terminalId: "t1", host: "office", isActive: true }),
      });
    });

    it("goes to the pane that shows it already", async () => {
      findTab.mockReturnValue("tab-1");

      await adapter.show("office", "t1");

      expect(navigate).toHaveBeenCalledWith("t1");
      expect(publish).not.toHaveBeenCalled();
    });

    it("takes a shell back that another Cogno shows, and waits until it is here", async () => {
      takeBack.mockResolvedValue(true);
      findTab.mockReturnValue("tab-1");

      await adapter.show("office", "t1");

      expect(takeBack).toHaveBeenCalledWith("t1");
      expect(navigate).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });

  it("says when this window began or stopped showing a shell, and only then", () => {
    let told = 0;
    adapter.shownHereChanged$.subscribe(() => told++);

    sessionChanges.next();
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "starting" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "running" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "running" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "takenOver" } });

    expect(told).toBe(3);
  });

  it("ends a shell on its machine", async () => {
    await adapter.end("office", "t1");

    expect(killSession).toHaveBeenCalledWith("office", "t1");
  });

  it("takes a shell that ended already as ended, and any other failure as one", async () => {
    killSession.mockRejectedValueOnce(new HostError("sessionNotFound", "gone"));
    await expect(adapter.end("office", "t1")).resolves.toBeUndefined();

    killSession.mockRejectedValueOnce(new HostError("notConnected", "not connected"));
    await expect(adapter.end("office", "t1")).rejects.toMatchObject({ code: "notConnected" });
  });
});
