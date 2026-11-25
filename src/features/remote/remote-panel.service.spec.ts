import type { DestroyRef } from "@angular/core";
import type { RemoteHost, RemoteShell, RemoteShellsPort } from "@cogno/core/api/remote-shells-port";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemotePanelService } from "./remote-panel.service";

function host(name: string, connection: RemoteHost["connection"]): RemoteHost {
  return { id: name, name, connection };
}

function shell(terminalId: string, overrides: Partial<RemoteShell> = {}): RemoteShell {
  return { terminalId, shown: "otherCogno", ...overrides };
}

/** Lets what was answered arrive. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("RemotePanelService", () => {
  let hosts$: BehaviorSubject<readonly RemoteHost[]>;
  let shownInThisWindowChanged$: Subject<void>;
  let port: {
    [K in
      | "shells"
      | "show"
      | "end"
      | "connect"
      | "disconnect"
      | "renameHost"
      | "removeHost"]: ReturnType<typeof vi.fn>;
  };
  let service: RemotePanelService;
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    hosts$ = new BehaviorSubject<readonly RemoteHost[]>([host("office", "disconnected")]);
    shownInThisWindowChanged$ = new Subject<void>();
    port = {
      shells: vi.fn().mockResolvedValue([]),
      show: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      renameHost: vi.fn().mockResolvedValue(undefined),
      removeHost: vi.fn().mockResolvedValue(true),
    };
    dispatch = vi.fn();
    service = new RemotePanelService(
      { hosts$, shownInThisWindowChanged$, ...port } as unknown as RemoteShellsPort,
      { dispatch } as never,
      { onDestroy: vi.fn() } as unknown as DestroyRef,
    );
  });

  it("says it refreshes until the hosts answered, and at least for a moment", async () => {
    vi.useFakeTimers();
    try {
      hosts$.next([host("office", "connected")]);
      let answer!: (shells: RemoteShell[]) => void;
      port.shells.mockReturnValue(new Promise((resolve) => (answer = resolve)));

      const refreshed = service.refresh();
      expect(service.refreshing()).toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      // Still waiting for the host.
      expect(service.refreshing()).toBe(true);

      answer([]);
      await refreshed;
      expect(service.refreshing()).toBe(false);

      // An answer that comes at once is still seen.
      port.shells.mockResolvedValue([]);
      const quick = service.refresh();
      await vi.advanceTimersByTimeAsync(100);
      expect(service.refreshing()).toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      await quick;
      expect(service.refreshing()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks nothing while the panel is closed", async () => {
    hosts$.next([host("office", "connected")]);
    await settled();

    expect(port.shells).not.toHaveBeenCalled();
    expect(service.hosts()).toEqual([host("office", "connected")]);
  });

  it("reads the shells of the connected machines when it opens", async () => {
    hosts$.next([host("office", "connected"), host("mac", "disconnected")]);
    port.shells.mockImplementation(async (name: string) => [shell(name)]);

    service.open();
    expect(service.shells().get("office")).toEqual({ status: "loading" });
    await settled();

    expect(port.shells).toHaveBeenCalledExactlyOnceWith("office");
    expect(service.shells().get("office")).toEqual({ status: "loaded", shells: [shell("office")] });
    expect(service.shells().has("mac")).toBe(false);
  });

  it("reads a machine's shells once it connects, and drops them when it is gone", async () => {
    service.open();
    await settled();
    expect(port.shells).not.toHaveBeenCalled();

    hosts$.next([host("office", "connected")]);
    await settled();
    expect(port.shells).toHaveBeenCalledExactlyOnceWith("office");
    expect(service.shells().get("office")).toEqual({ status: "loaded", shells: [] });

    hosts$.next([host("office", "disconnected")]);
    expect(service.shells().has("office")).toBe(false);
  });

  describe("with the office connected", () => {
    beforeEach(() => {
      hosts$.next([host("office", "connected")]);
    });

    it("says why a machine's shells could not be read", async () => {
      port.shells.mockRejectedValue(new Error("The connection was lost"));

      service.open();
      await settled();

      expect(service.shells().get("office")).toEqual({
        status: "failed",
        reason: "The connection was lost",
      });
    });

    it("forgets the shells when it closes, and an answer that comes late", async () => {
      let answer!: (shells: RemoteShell[]) => void;
      port.shells.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      service.open();

      service.close();
      answer([shell("t1")]);
      await settled();

      expect(service.shells().size).toBe(0);
    });

    it("takes only the newest answer, also when an older one comes last", async () => {
      const answers: ((shells: RemoteShell[]) => void)[] = [];
      port.shells.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
      service.open();
      service.refresh();

      answers[1]?.([shell("new")]);
      await settled();
      answers[0]?.([shell("old")]);
      await settled();

      expect(service.shells().get("office")).toEqual({ status: "loaded", shells: [shell("new")] });
    });

    it("does not take an answer asked before the panel closed", async () => {
      const answers: ((shells: RemoteShell[]) => void)[] = [];
      port.shells.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
      service.open();
      service.close();
      service.open();

      answers[0]?.([shell("before")]);
      await settled();

      expect(service.shells().get("office")).toEqual({ status: "loading" });
    });

    it("keeps what the host says after showing a shell over an answer from before", async () => {
      port.shells.mockResolvedValueOnce([shell("t1")]);
      service.open();
      await settled();
      let stale!: (shells: RemoteShell[]) => void;
      port.shells.mockReturnValueOnce(new Promise((resolve) => (stale = resolve)));
      service.refresh();
      port.shells.mockResolvedValueOnce([shell("t1", { shown: "thisWindow" })]);

      await service.show("office", shell("t1"));
      shownInThisWindowChanged$.next();
      stale([shell("t1")]);
      await settled();

      expect(service.shells().get("office")).toEqual({
        status: "loaded",
        shells: [shell("t1", { shown: "thisWindow" })],
      });
    });

    it("reads the host's shells again once this window shows one, instead of guessing", async () => {
      port.shells.mockResolvedValueOnce([shell("t1"), shell("t2")]);
      service.open();
      await settled();
      port.shells.mockResolvedValueOnce([shell("t1", { shown: "thisWindow" }), shell("t2")]);

      await service.show("office", shell("t1"));
      shownInThisWindowChanged$.next();
      await settled();

      expect(port.show).toHaveBeenCalledWith("office", "t1");
      expect(service.shells().get("office")).toEqual({
        status: "loaded",
        shells: [shell("t1", { shown: "thisWindow" }), shell("t2")],
      });
    });

    it("reads the host's shells again once one was ended", async () => {
      port.shells.mockResolvedValueOnce([shell("t1"), shell("t2")]);
      service.open();
      await settled();
      port.shells.mockResolvedValueOnce([shell("t2")]);

      await service.end("office", shell("t1"));

      expect(port.end).toHaveBeenCalledWith("office", "t1");
      expect(service.shells().get("office")).toEqual({ status: "loaded", shells: [shell("t2")] });
    });

    it("says why something did not work, until the next thing is tried", async () => {
      port.shells.mockResolvedValue([shell("t1")]);
      service.open();
      await settled();
      port.end.mockRejectedValueOnce(new Error("The host is not connected"));

      await service.end("office", shell("t1"));
      expect(service.failure()).toBe("The host is not connected");
      expect(service.shells().get("office")).toEqual({ status: "loaded", shells: [shell("t1")] });

      await service.end("office", shell("t1"));
      expect(service.failure()).toBeUndefined();
    });
  });

  it("hands back why a machine could not be saved", async () => {
    await expect(service.renameHost("office", "mac")).resolves.toBeUndefined();

    port.renameHost.mockRejectedValue(new Error("A remote needs a name."));
    await expect(service.renameHost("office", "mac")).resolves.toBe("A remote needs a name.");
  });

  it("removes a machine, and notifies when that machine did not hear of it", async () => {
    await service.removeHost(host("office", "connected"));
    expect(port.removeHost).toHaveBeenCalledWith("office");
    expect(dispatch).not.toHaveBeenCalled();

    port.removeHost.mockResolvedValue(false);
    await service.removeHost(host("office", "connected"));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        header: "Removed office here only",
        body: expect.stringMatching(/^office could not be reached.*refused/),
      }),
    );
  });

  it("leaves a failed connection to the host's own state", async () => {
    port.connect.mockRejectedValue(new Error("Permission denied"));

    service.connect("office");
    await settled();

    expect(service.failure()).toBeUndefined();
  });
});
