import type { DestroyRef } from "@angular/core";
import type { RemoteHost, RemoteShell, RemoteShellsPort } from "@cogno/core/api/remote-shells-port";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemotePanelService } from "./remote-panel.service";

function host(name: string, connection: RemoteHost["connection"]): RemoteHost {
  return { name, destination: `lars@${name}`, connection };
}

function shell(terminalId: string, overrides: Partial<RemoteShell> = {}): RemoteShell {
  return { terminalId, shown: true, shownHere: false, ...overrides };
}

/** Lets what was answered arrive. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("RemotePanelService", () => {
  let hosts$: BehaviorSubject<readonly RemoteHost[]>;
  let port: {
    [K in
      | "shells"
      | "open"
      | "end"
      | "connect"
      | "disconnect"
      | "saveHost"
      | "removeHost"]: ReturnType<typeof vi.fn>;
  };
  let service: RemotePanelService;

  beforeEach(() => {
    hosts$ = new BehaviorSubject<readonly RemoteHost[]>([host("office", "disconnected")]);
    port = {
      shells: vi.fn().mockResolvedValue([]),
      open: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      saveHost: vi.fn().mockResolvedValue(undefined),
      removeHost: vi.fn().mockResolvedValue(undefined),
    };
    service = new RemotePanelService(
      { hosts$, ...port } as unknown as RemoteShellsPort,
      { onDestroy: vi.fn() } as unknown as DestroyRef,
    );
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

    it("marks a shell as shown here once it was opened", async () => {
      port.shells.mockResolvedValue([shell("t1", { shownBy: "office-pc" }), shell("t2")]);
      service.open();
      await settled();

      await service.show("office", shell("t1"));

      expect(port.open).toHaveBeenCalledWith("office", "t1");
      expect(service.shells().get("office")).toEqual({
        status: "loaded",
        shells: [shell("t1", { shownHere: true, shownBy: undefined }), shell("t2")],
      });
    });

    it("takes an ended shell off the list", async () => {
      port.shells.mockResolvedValue([shell("t1"), shell("t2")]);
      service.open();
      await settled();

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
    await expect(service.saveHost({ name: "mac", destination: "mac" })).resolves.toBeUndefined();

    port.saveHost.mockRejectedValue(new Error("There is a remote called 'mac' already."));
    await expect(service.saveHost({ name: "mac", destination: "mac" })).resolves.toBe(
      "There is a remote called 'mac' already.",
    );
  });

  it("leaves a failed connection to the host's own state", async () => {
    port.connect.mockRejectedValue(new Error("Permission denied"));

    service.connect("office");
    await settled();

    expect(service.failure()).toBeUndefined();
  });
});
