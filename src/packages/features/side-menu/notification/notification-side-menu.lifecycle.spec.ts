import type { SideMenuFeatureHandleContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationCenterStateService } from "./notification-center-state.service";
import { NotificationSideMenuLifecycle } from "./notification-side-menu.lifecycle";

describe("NotificationSideMenuLifecycle", () => {
  let notificationCenterStateService: Pick<
    NotificationCenterStateService,
    | "handleSideMenuClose"
    | "handleSideMenuModeChange"
    | "handleSideMenuOpen"
    | "setSideMenuIconUpdater"
  >;
  let sideMenuFeatureHandle: SideMenuFeatureHandleContract<string>;

  beforeEach(() => {
    notificationCenterStateService = {
      handleSideMenuClose: vi.fn(),
      handleSideMenuModeChange: vi.fn(),
      handleSideMenuOpen: vi.fn(),
      setSideMenuIconUpdater: vi.fn(),
    };
    sideMenuFeatureHandle = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
      updateIcon: vi.fn(),
    };
  });

  it("wires the icon updater and delegates side menu lifecycle events", () => {
    const lifecycle = new NotificationSideMenuLifecycle(
      notificationCenterStateService as NotificationCenterStateService,
    ).create(sideMenuFeatureHandle);

    const iconUpdater = vi.mocked(notificationCenterStateService.setSideMenuIconUpdater).mock
      .calls[0]?.[0];
    expect(iconUpdater).toBeTypeOf("function");

    iconUpdater?.("bell");
    lifecycle.onModeChange?.("off");
    lifecycle.onOpen?.();
    lifecycle.onClose?.();

    expect(sideMenuFeatureHandle.updateIcon).toHaveBeenCalledWith("bell");
    expect(notificationCenterStateService.handleSideMenuModeChange).toHaveBeenCalledWith("off");
    expect(notificationCenterStateService.handleSideMenuOpen).toHaveBeenCalledTimes(1);
    expect(notificationCenterStateService.handleSideMenuClose).toHaveBeenCalledTimes(1);
  });

  it("registers Escape handling on focus and unregisters on blur", () => {
    const lifecycle = new NotificationSideMenuLifecycle(
      notificationCenterStateService as NotificationCenterStateService,
    ).create(sideMenuFeatureHandle);

    lifecycle.onFocus?.();

    const keybindHandler = vi.mocked(sideMenuFeatureHandle.registerKeybindListener).mock
      .calls[0]?.[1];
    expect(keybindHandler).toBeTypeOf("function");

    keybindHandler?.({ key: "Escape" } as KeyboardEvent);
    lifecycle.onBlur?.();

    expect(sideMenuFeatureHandle.close).toHaveBeenCalledTimes(1);
    expect(sideMenuFeatureHandle.unregisterKeybindListener).toHaveBeenCalledTimes(1);
  });
});
