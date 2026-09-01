import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import type { SessionHost, SessionRuntime } from "@cogno/core/session/host/session-host";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "../app-bus/app-bus";
import { TerminalComponent } from "./terminal.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The host as the pane sees it: two axes and a few streams. */
function hostStub(runtime$: BehaviorSubject<SessionRuntime>) {
  return {
    terminalId: "terminal-1",
    runtime$,
    get runtime() {
      return runtime$.value;
    },
    machine: {
      isFocused$: new BehaviorSubject(false),
      isInFullScreenMode$: new BehaviorSubject(false),
      scrolledLinesFromBottom$: new BehaviorSubject(0),
    },
    isWebglContextLost$: new BehaviorSubject(false),
    attach: vi.fn(),
    detach: vi.fn(),
    retry: vi.fn(),
    focus: vi.fn(),
    scrollToBottom: vi.fn(),
  };
}

describe("TerminalComponent (failed start)", () => {
  let runtime$: BehaviorSubject<SessionRuntime>;
  let host: ReturnType<typeof hostStub>;
  let bus: AppBus;
  let onDestroy: (() => void) | undefined;

  function createComponent(): TerminalComponent {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.runInInjectionContext(
      () =>
        new TerminalComponent(
          { onDestroy: (callback: () => void) => (onDestroy = callback) } as never,
          { openAtPoint: vi.fn() } as never,
          bus,
          host as unknown as SessionHost,
          { buildContextMenu: vi.fn(() => []) } as never,
          { setHostElement: vi.fn() } as never,
          { setHostElement: vi.fn() } as never,
          { setHostElement: vi.fn() } as never,
          { initialize: vi.fn() } as never,
        ),
    );
  }

  beforeEach(() => {
    runtime$ = new BehaviorSubject<SessionRuntime>({ status: "starting" });
    host = hostStub(runtime$);
    bus = new AppBus();
    vi.spyOn(bus, "publish");
  });

  it("shows the failed start with its reason", () => {
    const component = createComponent();

    runtime$.next({ status: "failed", reason: "no such shell" });

    expect(component.runtime()).toEqual({ status: "failed", reason: "no such shell" });
  });

  it("retries through the host and shows running afterwards", () => {
    const component = createComponent();
    runtime$.next({ status: "failed", reason: "no such shell" });

    component.retry();
    runtime$.next({ status: "running" });

    expect(host.retry).toHaveBeenCalledTimes(1);
    expect(component.runtime().status).toBe("running");
  });

  it("closes the pane through the workbench, not the host", () => {
    const component = createComponent();

    component.closeAfterFailure();

    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RemovePane", payload: "terminal-1" }),
    );
  });

  it("detaches on destroy and never closes the session itself", () => {
    createComponent();

    onDestroy?.();

    expect(host.detach).toHaveBeenCalledTimes(1);
    expect(host.attach).not.toHaveBeenCalled();
  });
});
