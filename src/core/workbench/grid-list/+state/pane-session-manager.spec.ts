import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { SessionBackend } from "@cogno/core/session/host/session-backend";
import { HostError, OsPlatform, SeenSessionContract } from "@cogno/platform";
import { Hosts } from "@cogno/platform/hosts";
import { filter, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../../../__test__/mocks/tauri-mock.factory";
import { Pane } from "../+model/model";
import { PaneSessionManager } from "./pane-session-manager";
import { SessionEntry, SessionStart } from "./session-scope.builder";
import { FoundShell } from "./waiting-panes";

type Fact = { terminalId: string; fact: { type: string; exit?: { kind: string } } };

/** A shell another Cogno shows right now. */
function shownByLaptop(terminalId: string): SeenSessionContract {
  return {
    ...TauriMockFactory.createSessionInfo(terminalId),
    attached: { to: "otherClient", by: "laptop" },
  };
}

/** What `PaneSessionManager` decides for a pane, seen from what it asks of its helpers. */
describe("PaneSessionManager", () => {
  const localPane = { terminalId: "t1", shellName: "zsh" } as Pane;
  const remotePane = { terminalId: "t2", shellName: "zsh", host: "office" } as Pane;
  let opened: { terminalId: string; backend: SessionBackend; start: SessionStart }[];
  let closed: { terminalId: string; removed: boolean }[];
  let entries: Map<string, SessionEntry>;
  let waiting: Set<string>;
  let onFound: Map<string, (found: FoundShell) => void>;
  let waitingPanes: {
    isWaiting: ReturnType<typeof vi.fn>;
    wait: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    showGone: ReturnType<typeof vi.fn>;
    mount: ReturnType<typeof vi.fn>;
  };
  let session: ReturnType<typeof vi.fn>;
  let claimed: SeenSessionContract | undefined;
  let facts: Subject<Fact>;
  let reattachments: Subject<{ type: string; payload?: string }>;
  let paneSessionManager: PaneSessionManager;

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    opened = [];
    closed = [];
    entries = new Map();
    waiting = new Set();
    onFound = new Map();
    facts = new Subject();
    reattachments = new Subject();
    claimed = undefined;
    session = vi.fn(async (_host: string | undefined, terminalId: string) =>
      TauriMockFactory.createSessionInfo(terminalId),
    );
    waitingPanes = {
      isWaiting: vi.fn((terminalId: string) => waiting.has(terminalId)),
      wait: vi.fn((pane: Pane, found: (shell: FoundShell) => void) => {
        waiting.add(pane.terminalId as string);
        onFound.set(pane.terminalId as string, (shell) => {
          waiting.delete(pane.terminalId as string);
          found(shell);
        });
      }),
      stop: vi.fn((terminalId: string) => waiting.delete(terminalId)),
      showGone: vi.fn((pane: Pane) => waiting.add(pane.terminalId as string)),
      mount: vi.fn(),
    };
    const scopes = {
      open: vi.fn(
        (terminalId: string, pane: Pane, backend: SessionBackend, start: SessionStart) => {
          opened.push({ terminalId, backend, start });
          const entry = {
            pane,
            backend,
            session: {
              runtime: { status: "starting" },
              failStart: vi.fn(),
              retry: vi.fn(),
              runsOnThisMachine: backend.host === undefined,
            },
            keybindings: {},
            view: {
              location: { nativeElement: document.createElement("div") },
              changeDetectorRef: { detectChanges: vi.fn() },
            },
          } as unknown as SessionEntry;
          entries.set(terminalId, entry);
          return entry;
        },
      ),
      close: vi.fn((terminalId: string, _entry: SessionEntry, removed: boolean) =>
        closed.push({ terminalId, removed }),
      ),
    };
    paneSessionManager = new PaneSessionManager(
      {} as never,
      {
        getShellProfileOrDefault: () => ({ shell_type: "ZSH", path: "/bin/zsh" }),
      } as unknown as ConfigService,
      {
        on$: (type: string) => reattachments.pipe(filter((action) => action.type === type)),
      } as never,
      { facts$: facts } as never,
      { platform: () => "linux" } as unknown as OsPlatform,
      { session } as unknown as Hosts,
      { claim: () => claimed } as never,
      scopes as never,
      waitingPanes as never,
      { onDestroy: vi.fn() } as never,
    );
  });

  /** Says what the session `terminalId` does now. */
  function runtimeOf(terminalId: string, status: string): void {
    (entries.get(terminalId)?.session as unknown as { runtime: { status: string } }).runtime = {
      status,
    };
  }

  describe("a pane of this machine", () => {
    it("starts a shell of its profile", () => {
      paneSessionManager.ensureSession(localPane);

      expect(opened).toEqual([
        {
          terminalId: "t1",
          backend: { os: "linux" },
          start: { kind: "spawn", profile: { shell_type: "ZSH", path: "/bin/zsh" } },
        },
      ]);
    });

    it("shows the shell that ran when the window started instead of starting one", () => {
      claimed = TauriMockFactory.createSessionInfo("t1");

      paneSessionManager.ensureSession(localPane);

      expect(opened[0]?.start).toMatchObject({
        kind: "showRunning",
        shell: { profile: { shell_type: "Bash" }, sessionToken: "running-token" },
      });
    });

    it("is a no-op once its session exists", () => {
      paneSessionManager.ensureSession(localPane);
      paneSessionManager.ensureSession(localPane);

      expect(opened).toHaveLength(1);
    });

    it("shows the shell its start found running, asked for afresh", async () => {
      paneSessionManager.ensureSession(localPane);

      facts.next({ terminalId: "t1", fact: { type: "shellAlreadyRuns" } });
      await settle();

      expect(session).toHaveBeenCalledExactlyOnceWith(undefined, "t1");
      expect(closed).toEqual([{ terminalId: "t1", removed: false }]);
      expect(opened[1]?.start.kind).toBe("showRunning");
    });

    it("fails its start when the shell it found running cannot be asked for", async () => {
      const lost = new HostError("connectionLost", "lost");
      session.mockRejectedValueOnce(lost);
      paneSessionManager.ensureSession(localPane);

      facts.next({ terminalId: "t1", fact: { type: "shellAlreadyRuns" } });
      await settle();

      const started = entries.get("t1")?.session as unknown as {
        failStart: ReturnType<typeof vi.fn>;
      };
      expect(started.failStart).toHaveBeenCalledExactlyOnceWith(lost);
      expect(opened).toHaveLength(1);
    });

    it("shows on a shell this window showed before its webview was loaded again", () => {
      claimed = {
        ...TauriMockFactory.createSessionInfo("t1"),
        attached: { to: "thisClient" },
        shownInThisWindow: true,
      };

      paneSessionManager.ensureSession(localPane);

      expect(opened[0]?.start.kind).toBe("showRunning");
    });

    it("says a shell another window of this Cogno shows is shown there", () => {
      claimed = { ...TauriMockFactory.createSessionInfo("t1"), attached: { to: "thisClient" } };

      paneSessionManager.ensureSession(localPane);

      expect(opened[0]?.start.kind).toBe("shownElsewhere");
    });

    it("says a shell another Cogno shows is shown there, and does not take it", () => {
      claimed = shownByLaptop("t1");

      paneSessionManager.ensureSession(localPane);

      expect(opened[0]?.start).toMatchObject({ kind: "shownElsewhere", by: "laptop" });
    });

    it("does not take the shell its start found running when another Cogno shows it", async () => {
      session.mockResolvedValueOnce(shownByLaptop("t1"));
      paneSessionManager.ensureSession(localPane);

      facts.next({ terminalId: "t1", fact: { type: "shellAlreadyRuns" } });
      await settle();

      expect(opened[1]?.start.kind).toBe("shownElsewhere");
    });

    it("stays when its shell ended without the user, and says so itself", () => {
      paneSessionManager.ensureSession(localPane);

      for (const kind of ["killedByAnotherClient", "ptyFailed", "connectionLost"]) {
        facts.next({ terminalId: "t1", fact: { type: "exited", exit: { kind } } });
      }

      expect(closed).toEqual([]);
      expect(waitingPanes.wait).not.toHaveBeenCalled();
    });

    it("starts a shell after all when the one it was to show had ended", () => {
      claimed = TauriMockFactory.createSessionInfo("t1");
      paneSessionManager.ensureSession(localPane);

      facts.next({ terminalId: "t1", fact: { type: "shellGone" } });

      expect(closed).toEqual([{ terminalId: "t1", removed: false }]);
      expect(opened[1]?.start.kind).toBe("spawn");
    });
  });

  describe("a pane of another machine", () => {
    it("has no session while it waits for its machine and its shell", () => {
      expect(paneSessionManager.ensureSession(remotePane)).toBeUndefined();
      expect(paneSessionManager.ensureSession(remotePane)).toBeUndefined();

      expect(waitingPanes.wait).toHaveBeenCalledOnce();
      expect(opened).toEqual([]);
    });

    it("gets a session that shows the shell it found, on the machine's system", () => {
      paneSessionManager.ensureSession(remotePane);

      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "windows" });

      expect(opened).toHaveLength(1);
      expect(opened[0]?.backend).toEqual({ host: "office", os: "windows" });
      expect(opened[0]?.start.kind).toBe("showRunning");
    });

    it("puts its terminal where the pane is once the shell is found", () => {
      const mountPoint = document.createElement("div");
      paneSessionManager.mount(remotePane, mountPoint);
      expect(waitingPanes.mount).toHaveBeenCalledWith("t2", mountPoint);

      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "linux" });

      expect(mountPoint.childElementCount).toBe(1);
    });

    it("says another Cogno shows the shell it found, unless the user opened it to show it", () => {
      paneSessionManager.ensureSession(remotePane);
      onFound.get("t2")?.({ session: shownByLaptop("t2"), os: "linux" });
      expect(opened[0]?.start.kind).toBe("shownElsewhere");

      paneSessionManager.destroy("t2");
      paneSessionManager.takeOverWhenOpened("t2");
      paneSessionManager.ensureSession(remotePane);
      onFound.get("t2")?.({ session: shownByLaptop("t2"), os: "linux" });
      expect(opened[1]?.start.kind).toBe("showRunning");
    });

    it("waits for its machine again when the connection broke; the shell may run on", () => {
      const mountPoint = document.createElement("div");
      paneSessionManager.mount(remotePane, mountPoint);
      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "linux" });

      facts.next({ terminalId: "t2", fact: { type: "exited", exit: { kind: "connectionLost" } } });

      expect(closed).toEqual([{ terminalId: "t2", removed: false }]);
      expect(waitingPanes.wait).toHaveBeenCalledTimes(2);
      expect(waitingPanes.mount).toHaveBeenLastCalledWith("t2", mountPoint);
    });

    it("leaves a pane whose shell the user ended to the workbench", () => {
      paneSessionManager.ensureSession(remotePane);
      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "linux" });

      facts.next({ terminalId: "t2", fact: { type: "exited", exit: { kind: "hungUp" } } });
      facts.next({ terminalId: "t2", fact: { type: "exited", exit: { kind: "exited" } } });

      expect(closed).toEqual([]);
      expect(waitingPanes.wait).toHaveBeenCalledOnce();
    });

    it("waits for its machine when the user takes the shell back while it is not connected", async () => {
      paneSessionManager.ensureSession(remotePane);
      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "linux" });
      runtimeOf("t2", "takenOver");
      session.mockRejectedValueOnce(new HostError("notConnected", "not connected"));

      await expect(paneSessionManager.takeBack("t2")).resolves.toBe(true);
      expect(waitingPanes.wait).toHaveBeenCalledTimes(2);

      // Found again: the user asked for it, so it is taken from whoever shows it.
      onFound.get("t2")?.({ session: shownByLaptop("t2"), os: "linux" });
      expect(opened.at(-1)?.start.kind).toBe("showRunning");
    });

    it("says the shell is gone when it ended before the session attached", () => {
      const mountPoint = document.createElement("div");
      paneSessionManager.mount(remotePane, mountPoint);
      onFound.get("t2")?.({ session: TauriMockFactory.createSessionInfo("t2"), os: "linux" });

      facts.next({ terminalId: "t2", fact: { type: "shellGone" } });

      // The terminal stays: features must not hear that it went.
      expect(closed).toEqual([{ terminalId: "t2", removed: false }]);
      expect(waitingPanes.showGone).toHaveBeenCalledWith(remotePane, expect.any(Function));
      expect(waitingPanes.mount).toHaveBeenLastCalledWith("t2", mountPoint);
      expect(opened).toHaveLength(1);
    });
  });

  describe("a shell another Cogno took over", () => {
    beforeEach(() => {
      paneSessionManager.ensureSession(localPane);
      runtimeOf("t1", "takenOver");
    });

    it("is shown here again when the user asks, with what its host says of it now", async () => {
      session.mockResolvedValueOnce(shownByLaptop("t1"));

      await expect(paneSessionManager.takeBack("t1")).resolves.toBe(true);

      expect(session).toHaveBeenCalledExactlyOnceWith(undefined, "t1");
      expect(opened[1]?.start.kind).toBe("showRunning");
    });

    it("comes back by itself when that Cogno lets it go", async () => {
      facts.next({ terminalId: "t1", fact: { type: "handedBack" } });
      await settle();

      expect(opened).toHaveLength(2);
    });

    it("comes back when a pane asks for it on the bus", async () => {
      reattachments.next({ type: "ReattachTerminal", payload: "t1" });
      await settle();

      expect(opened).toHaveLength(2);
    });

    it("is not taken back while it runs here", async () => {
      runtimeOf("t1", "running");

      await expect(paneSessionManager.takeBack("t1")).resolves.toBe(false);
      expect(session).not.toHaveBeenCalled();
    });

    it("starts a new shell here when it ended meanwhile", async () => {
      session.mockRejectedValueOnce(new HostError("sessionNotFound", "gone"));

      await expect(paneSessionManager.takeBack("t1")).resolves.toBe(false);

      expect(opened[1]?.start.kind).toBe("spawn");
    });
  });

  it("closes a pane for good: what waits stops, and the app hears the terminal went", () => {
    paneSessionManager.ensureSession(localPane);

    paneSessionManager.destroy("t1");

    expect(waitingPanes.stop).toHaveBeenCalledWith("t1");
    expect(closed).toEqual([{ terminalId: "t1", removed: true }]);
    expect(paneSessionManager.getSessionKeybindings("t1")).toBeUndefined();
  });
});
