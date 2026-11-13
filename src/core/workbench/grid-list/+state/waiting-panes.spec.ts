import { ApplicationRef, EnvironmentInjector, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import {
  ConnectError,
  RemoteHostConnection,
  RemoteHostsService,
} from "@cogno/core/workbench/hosts/remote-hosts.service";
import { HostError } from "@cogno/platform";
import { HostInfo, Hosts } from "@cogno/platform/hosts";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TauriMockFactory } from "../../../../__test__/mocks/tauri-mock.factory";
import { Pane } from "../+model/model";
import { FoundShell, WaitingPanes } from "./waiting-panes";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const pane = { terminalId: "t1", shellName: "zsh", host: "office" } as Pane & { host: string };

describe("WaitingPanes", () => {
  let connections: BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>;
  let info: HostInfo | undefined;
  let connect: ReturnType<typeof vi.fn>;
  let session: ReturnType<typeof vi.fn>;
  let publish: ReturnType<typeof vi.fn>;
  let waitingPanes: WaitingPanes;
  let mountPoint: HTMLElement;
  let found: FoundShell[];

  /** Lets the answers the fakes gave arrive. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));
  const shown = () => mountPoint.textContent?.replace(/\s+/g, " ").trim();
  const buttons = () =>
    [...mountPoint.querySelectorAll("button")].map((b) => b.textContent?.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    connections = new BehaviorSubject<ReadonlyMap<string, RemoteHostConnection>>(new Map());
    info = undefined;
    connect = vi.fn(async () => {
      info = { os: "linux" };
      return info;
    });
    session = vi.fn(async () => TauriMockFactory.createSessionInfo("t1"));
    publish = vi.fn();
    waitingPanes = new WaitingPanes(
      TestBed.inject(EnvironmentInjector),
      TestBed.inject(ApplicationRef),
      { publish } as never,
      { connections$: connections, info: () => info, connect } as unknown as RemoteHostsService,
      { session } as unknown as Hosts,
      { onDestroy: vi.fn() } as never,
    );
    mountPoint = document.createElement("div");
    found = [];
  });

  function waitForShell(): void {
    waitingPanes.wait(pane, (shell) => found.push(shell));
    waitingPanes.mount("t1", mountPoint);
  }

  it("connects the machine, asks for the shell and hands it over with its system", async () => {
    waitForShell();
    await settle();

    expect(connect).toHaveBeenCalledExactlyOnceWith("office");
    expect(session).toHaveBeenCalledExactlyOnceWith("office", "t1");
    expect(found).toEqual([{ session: TauriMockFactory.createSessionInfo("t1"), os: "linux" }]);
    // It waits no more: its view is gone.
    expect(waitingPanes.isWaiting("t1")).toBe(false);
    expect(mountPoint.childElementCount).toBe(0);
  });

  it("waits once, however often the pane asks", async () => {
    waitForShell();
    waitingPanes.wait(pane, (shell) => found.push(shell));
    await settle();

    expect(connect).toHaveBeenCalledOnce();
    expect(found).toHaveLength(1);
  });

  it("says that the shell is gone when the machine answers so, and offers no retry", async () => {
    session.mockRejectedValue(new HostError("sessionNotFound", "No session runs under t1"));

    waitForShell();
    await settle();

    expect(shown()).toContain("The shell no longer runs on office");
    expect(buttons()).toEqual(["Close"]);
    expect(found).toEqual([]);
  });

  it("offers to try again after a connection that could work next time", async () => {
    connect.mockRejectedValueOnce(
      new ConnectError({ code: "noCognoThere", message: "No Cogno host answered" }),
    );

    waitForShell();
    await settle();

    expect(shown()).toContain("Could not connect to office");
    expect(shown()).toContain("No Cogno host answered");
    expect(buttons()).toEqual(["Retry", "Close"]);

    mountPoint.querySelector("button")?.click();
    await settle();
    expect(found).toHaveLength(1);
  });

  it("offers no retry where something has to change first", async () => {
    connect.mockRejectedValueOnce(
      new ConnectError({ code: "hostTooOld", message: "update it there" }),
    );

    waitForShell();
    await settle();

    expect(buttons()).toEqual(["Close"]);
  });

  it("asks for the shell once the machine is connected by someone else", async () => {
    connect.mockRejectedValueOnce(new ConnectError({ code: "connectFailed", message: "denied" }));
    waitForShell();
    await settle();
    expect(found).toEqual([]);

    // The user connects from the Remote panel.
    info = { os: "macos" };
    connections.next(new Map([["office", { status: "connected", info }]]));
    await settle();

    expect(found).toEqual([{ session: TauriMockFactory.createSessionInfo("t1"), os: "macos" }]);
  });

  it("says that the machine did not answer, not that the shell is gone", async () => {
    session.mockRejectedValue(new HostError("io", "broken pipe"));

    waitForShell();
    await settle();

    expect(shown()).toContain("office did not say whether the shell runs");
    expect(buttons()).toEqual(["Retry", "Close"]);
  });

  it("hands nothing over for a pane that stopped waiting meanwhile", async () => {
    waitingPanes.wait(pane, (shell) => found.push(shell));
    waitingPanes.stop("t1");
    await settle();

    expect(found).toEqual([]);
  });

  it("closes the pane when asked", async () => {
    session.mockRejectedValue(new HostError("sessionNotFound", "gone"));
    waitForShell();
    await settle();

    [...mountPoint.querySelectorAll("button")]
      .find((b) => b.textContent?.trim() === "Close")
      ?.click();

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ActionFired", payload: expect.anything() }),
    );
  });
});
