import { Injector, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationCenterStateService } from "./notification-center-state.service";
import { NotificationSideMenuLifecycle } from "./notification-side-menu.lifecycle";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe("NotificationSideMenuLifecycle", () => {
  let unread: ReturnType<typeof signal<boolean>>;
  let stateService: {
    unread: typeof unread;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };
  let handle: SideMenuFeatureHandleContract<string>;
  let lifecycle: ReturnType<NotificationSideMenuLifecycle["create"]>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    unread = signal(false);
    stateService = { unread, start: vi.fn(), stop: vi.fn(), markRead: vi.fn() };
    handle = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
      updateBadgeColor: vi.fn(),
    };
    lifecycle = new NotificationSideMenuLifecycle(
      stateService as unknown as NotificationCenterStateService,
    ).create(TestBed.inject(Injector), handle);
  });

  it("collects while the feature is on and stops with a plain icon when it is off", () => {
    lifecycle.onModeChange?.("on");
    expect(stateService.start).toHaveBeenCalledOnce();

    lifecycle.onModeChange?.("off");
    expect(stateService.stop).toHaveBeenCalledOnce();
    expect(handle.updateIcon).toHaveBeenLastCalledWith("mdiBell");
  });

  it("shows the badge while something is unread and marks it read on open", () => {
    lifecycle.onModeChange?.("on");
    unread.set(true);
    TestBed.tick();
    expect(handle.updateIcon).toHaveBeenLastCalledWith("mdiBellBadge");

    lifecycle.onOpen?.();
    expect(stateService.markRead).toHaveBeenCalledOnce();
    unread.set(false);
    TestBed.tick();
    expect(handle.updateIcon).toHaveBeenLastCalledWith("mdiBell");
  });

  it("registers Escape handling on focus and unregisters on blur", () => {
    lifecycle.onFocus?.();
    const keybindHandler = vi.mocked(handle.registerKeybindListener).mock.calls[0]?.[1];
    keybindHandler?.({ key: "Escape" } as KeyboardEvent);
    lifecycle.onBlur?.();

    expect(handle.close).toHaveBeenCalledTimes(1);
    expect(handle.unregisterKeybindListener).toHaveBeenCalledTimes(1);
  });
});
