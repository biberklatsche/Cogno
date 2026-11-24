import { RemoteHost } from "@cogno/core/api/remote-shells-port";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { RemoteHostConnection } from "@cogno/core/workbench/hosts/remote-hosts.service";
import { HostError, PairedMachineContract, SeenSessionContract } from "@cogno/platform";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteShellsAdapterService } from "./remote-shells.adapter.service";

const laptop: PairedMachineContract = { name: "laptop", endpointId: "laptop-id" };
const office: PairedMachineContract = { name: "office", endpointId: "office-id" };

describe("RemoteShellsAdapterService", () => {
  let connections$: BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>;
  let machines$: BehaviorSubject<readonly PairedMachineContract[]>;
  let rename: ReturnType<typeof vi.fn>;
  let removePaired: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let sessions: ReturnType<typeof vi.fn>;
  let killSession: ReturnType<typeof vi.fn>;
  let takeBack: ReturnType<typeof vi.fn>;
  let takeOverWhenOpened: ReturnType<typeof vi.fn>;
  let sessionChanges: Subject<void>;
  let sessionRuntimes: Subject<{ terminalId: string; runtime: { status: string } }>;
  let sessionEntries: {
    terminalId: string;
    host: { state: { shellContext: { host?: string } }; runtime: { status: string } };
  }[];
  let findTab: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let publish: ReturnType<typeof vi.fn>;
  let adapter: RemoteShellsAdapterService;

  beforeEach(() => {
    connections$ = new BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>(new Map());
    machines$ = new BehaviorSubject<readonly PairedMachineContract[]>([office]);
    rename = vi.fn().mockResolvedValue(undefined);
    removePaired = vi.fn().mockResolvedValue(true);
    disconnect = vi.fn().mockResolvedValue(undefined);
    sessions = vi.fn().mockResolvedValue([]);
    killSession = vi.fn().mockResolvedValue(undefined);
    takeBack = vi.fn().mockResolvedValue(false);
    takeOverWhenOpened = vi.fn();
    sessionChanges = new Subject();
    sessionRuntimes = new Subject();
    sessionEntries = [];
    findTab = vi.fn();
    navigate = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn();
    adapter = new RemoteShellsAdapterService(
      { connections$, connect: vi.fn(), disconnect } as never,
      {
        machines$,
        get machines() {
          return machines$.value;
        },
        get pairedNames() {
          return machines$.value.map(({ name }) => name);
        },
        nameOf: (id: string) => machines$.value.find((machine) => machine.endpointId === id)?.name,
      } as never,
      { rename, remove: removePaired } as never,
      { sessions, killSession } as never,
      { takeBack, takeOverWhenOpened } as never,
      {
        changes$: sessionChanges,
        runtimes$: sessionRuntimes,
        get entries() {
          return sessionEntries;
        },
        get: (terminalId: string) =>
          sessionEntries.find((entry) => entry.terminalId === terminalId),
      } as never,
      { findTabIdByTerminalId: findTab } as never,
      { navigateToTerminal: navigate } as never,
      { publish } as never,
    );
  });

  it("lists the paired machines with how far their connection is", () => {
    let hosts: readonly RemoteHost[] = [];
    adapter.hosts$.subscribe((next) => (hosts = next));
    expect(hosts).toEqual([
      { id: "office-id", name: "office", connection: "disconnected", failure: undefined },
    ]);

    connections$.next(
      new Map([
        [
          "office-id",
          { status: "failed", failure: { code: "connectFailed", message: "No route to host" } },
        ],
      ]),
    );
    expect(hosts[0]).toMatchObject({
      connection: "failed",
      failure: { message: "No route to host", worthRetrying: true },
    });

    connections$.next(
      new Map([
        [
          "office-id",
          {
            status: "failed",
            failure: { code: "notPaired", message: "Not paired any more" },
          },
        ],
      ]),
    );
    // Connecting again fails the same way until the machines are paired again.
    expect(hosts[0]).toMatchObject({ failure: { worthRetrying: false } });

    machines$.next([office, { name: "nas", endpointId: "b" }]);
    expect(hosts.map(({ name }) => name)).toEqual(["office", "nas"]);

    machines$.next([]);
    expect(hosts).toEqual([]);
  });

  describe("a paired machine", () => {
    beforeEach(() => machines$.next([office, laptop]));

    it("is renamed in the pairing, to a name no other remote has; its connection stays", async () => {
      await expect(adapter.renameHost("laptop-id", "office")).rejects.toThrow("already");
      await expect(adapter.renameHost("laptop-id", "  ")).rejects.toThrow();
      expect(rename).not.toHaveBeenCalled();

      await adapter.renameHost("laptop-id", " notebook ");

      expect(rename).toHaveBeenCalledWith("laptop-id", "notebook");
      // It is known by its id: what stands, and its panes, are untouched.
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("leaves the pairing alone when the name stays", async () => {
      await adapter.renameHost("laptop-id", " laptop ");

      expect(rename).not.toHaveBeenCalled();
    });

    it("is hung up on and removed from the pairing", async () => {
      const warn = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
      try {
        await adapter.removeHost("laptop-id");

        expect(disconnect).toHaveBeenCalledWith("laptop-id");
        expect(removePaired).toHaveBeenCalledWith("laptop-id");
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("tells the user when the other machine did not hear of its removal", async () => {
      const warn = vi.spyOn(ErrorReporter, "reportWarning").mockImplementation(() => undefined);
      removePaired.mockResolvedValue(false);
      try {
        await adapter.removeHost("laptop-id");

        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({
            notify: true,
            message: expect.stringMatching(/^Removed laptop here.*refused/),
          }),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  it("says what runs on a machine, in the words of the Cogno it belongs to", async () => {
    const session: SeenSessionContract = {
      terminalId: "t1",
      placement: { workspace: "Cogno", tab: "build", title: null, directory: "C:\\dev" },
      profile: {
        shell_type: "PowerShell",
        inject_cogno_cli: true,
        enable_shell_integration: true,
        load_user_rc: true,
      },
      size: { cols: 80, rows: 24 },
      attached: { to: "otherClient", by: "lars-laptop" },
      shownInThisWindow: false,
    };
    sessions.mockResolvedValue([session]);

    await expect(adapter.shells("office")).resolves.toEqual([
      {
        terminalId: "t1",
        workspace: "Cogno",
        tab: "build",
        title: undefined,
        directory: "C:\\dev",
        shown: "otherCogno",
        shownBy: "lars-laptop",
      },
    ]);
    expect(sessions).toHaveBeenCalledWith("office");
  });

  it("tells this window from the other windows of this Cogno", async () => {
    const shownByThisCogno = (
      terminalId: string,
      shownInThisWindow: boolean,
    ): SeenSessionContract => ({
      terminalId,
      placement: {},
      profile: {
        shell_type: "Bash",
        inject_cogno_cli: true,
        enable_shell_integration: true,
        load_user_rc: true,
      },
      size: { cols: 80, rows: 24 },
      attached: { to: "thisClient" },
      shownInThisWindow,
    });
    // The app says which of its windows shows a shell.
    sessions.mockResolvedValue([shownByThisCogno("t1", true), shownByThisCogno("t2", false)]);

    const shells = await adapter.shells("office");

    expect(shells.map(({ shown }) => shown)).toEqual(["thisWindow", "otherWindow"]);
  });

  describe("showing a shell here", () => {
    it("opens a tab for a shell no pane here shows; the pane asks for it itself", async () => {
      await adapter.show("office", "t1");

      // The user asked for it here: the new pane takes it from whoever shows it.
      expect(takeOverWhenOpened).toHaveBeenCalledWith("t1");
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

  /** Registers a session, as the registry does, of `host` or of this machine. */
  function register(terminalId: string, host?: string, status = "starting"): void {
    sessionEntries.push({
      terminalId,
      host: { state: { shellContext: { host } }, runtime: { status } },
    });
    sessionChanges.next();
  }

  function unregister(terminalId: string): void {
    sessionEntries = sessionEntries.filter((entry) => entry.terminalId !== terminalId);
    sessionChanges.next();
  }

  it("says when this window began or stopped showing a shell of another machine", () => {
    let told = 0;
    adapter.shownInThisWindowChanged$.subscribe(() => told++);

    register("t1", "office");
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "starting" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "running" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "running" } });
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "takenOver" } });
    expect(told).toBe(2);

    unregister("t1");
    expect(told).toBe(3);
  });

  it("says nothing when a shell of this machine comes or goes", () => {
    let told = 0;
    adapter.shownInThisWindowChanged$.subscribe(() => told++);

    register("t1");
    sessionRuntimes.next({ terminalId: "t1", runtime: { status: "running" } });
    unregister("t1");

    expect(told).toBe(0);
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
