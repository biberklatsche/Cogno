import { Injector, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import type { UpdaterState } from "@cogno/platform/updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdaterService } from "./updater.service";
import { UpdaterSideMenuLifecycle } from "./updater-side-menu.lifecycle";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("UpdaterSideMenuLifecycle", () => {
  let updaterState: ReturnType<typeof signal<UpdaterState | undefined>>;
  let updaterService: {
    state: typeof updaterState;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let handle: SideMenuFeatureHandleContract<string>;
  let lifecycle: ReturnType<UpdaterSideMenuLifecycle["create"]>;

  function phase(value: UpdaterState["phase"]): UpdaterState {
    return {
      phase: value,
      currentVersion: "0.5.0",
      version: "0.6.0",
      notes: null,
      installable: true,
      error: null,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    updaterState = signal<UpdaterState | undefined>(undefined);
    updaterService = { state: updaterState, start: vi.fn(), stop: vi.fn() };
    handle = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
      updateBadgeColor: vi.fn(),
    };
    lifecycle = new UpdaterSideMenuLifecycle(updaterService as unknown as UpdaterService).create(
      TestBed.inject(Injector),
      handle,
    );
  });

  it("asks for updates while the feature is on and stops when it is off", () => {
    lifecycle.onModeChange?.("on");
    expect(updaterService.start).toHaveBeenCalledOnce();

    lifecycle.onModeChange?.("off");
    expect(updaterService.stop).toHaveBeenCalledOnce();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith(undefined);
  });

  it("shows the badge while a new version waits for the user", () => {
    lifecycle.onModeChange?.("on");
    updaterState.set(phase("downloading"));
    TestBed.tick();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith(undefined);

    updaterState.set(phase("ready"));
    TestBed.tick();
    expect(handle.updateBadgeColor).toHaveBeenLastCalledWith("var(--color-green)");
  });

  it("stops updating the badge once the feature is off", () => {
    lifecycle.onModeChange?.("on");
    TestBed.tick();
    lifecycle.onModeChange?.("off");
    const calls = vi.mocked(handle.updateBadgeColor).mock.calls.length;

    updaterState.set(phase("ready"));
    TestBed.tick();
    expect(vi.mocked(handle.updateBadgeColor).mock.calls.length).toBe(calls);
  });
});
