import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { RemoteHostConnection } from "@cogno/core/workbench/remote/remote-hosts.service";
import { RunningSession } from "@cogno/platform/hosts";
import { BehaviorSubject } from "rxjs";
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
  let refresh: ReturnType<typeof vi.fn>;
  let sessions: ReturnType<typeof vi.fn>;
  let endSession: ReturnType<typeof vi.fn>;
  let shownSession: ReturnType<typeof vi.fn>;
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
    refresh = vi.fn().mockResolvedValue(undefined);
    sessions = vi.fn().mockResolvedValue([]);
    endSession = vi.fn().mockResolvedValue(undefined);
    shownSession = vi.fn();
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
      { refresh } as never,
      { sessions, endSession } as never,
      { get: shownSession } as never,
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

    connections$.next(new Map([["office", { status: "failed", reason: "No route to host" }]]));
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
    const session: RunningSession = {
      terminalId: "t1",
      label: { workspace: "Cogno", tab: "build", title: null, directory: "C:\\dev" },
      profile: { shell_type: "PowerShell" },
      shown: true,
      shownHere: false,
      shownBy: "lars-laptop",
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
    it("opens a tab for a shell no pane here shows, once the host said what runs now", async () => {
      await adapter.show("office", "t1");

      expect(refresh).toHaveBeenCalledWith("office");
      expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(
        publish.mock.invocationCallOrder[0] as number,
      );
      expect(publish).toHaveBeenCalledWith({
        type: "CreateTab",
        payload: expect.objectContaining({ terminalId: "t1", host: "office", isActive: true }),
      });
    });

    it("goes to the pane that shows it already", async () => {
      shownSession.mockReturnValue({ host: { runtime: { status: "running" } } });
      findTab.mockReturnValue("tab-1");

      await adapter.show("office", "t1");

      expect(navigate).toHaveBeenCalledWith("t1");
      expect(publish).not.toHaveBeenCalled();
    });

    it("takes a shell back that another Cogno shows", async () => {
      shownSession.mockReturnValue({ host: { runtime: { status: "takenOver" } } });
      findTab.mockReturnValue("tab-1");

      await adapter.show("office", "t1");

      expect(publish).toHaveBeenCalledWith({ type: "RetakeTerminal", payload: "t1" });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it("ends a shell on its machine", async () => {
    await adapter.end("office", "t1");

    expect(endSession).toHaveBeenCalledWith("office", "t1");
  });
});
