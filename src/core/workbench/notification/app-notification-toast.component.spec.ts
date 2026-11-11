import { signal } from "@angular/core";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { NotificationTargetContract } from "@cogno/shared/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotificationChannelService } from "./+state/app-notification-channel.service";
import type { AppNotificationToast } from "./+state/app-notification-toast.models";
import { AppNotificationToastComponent } from "./app-notification-toast.component";

describe("AppNotificationToastComponent", () => {
  const now = new Date("2026-11-11T12:00:00.000Z").getTime();
  const target: NotificationTargetContract = { workspaceId: "workspace-1", tabId: "tab-1" };
  const shownToast = signal<AppNotificationToast | undefined>(undefined);
  let appNotificationChannelService: Pick<
    AppNotificationChannelService,
    "appNotificationToast" | "dismissAppNotificationToast"
  >;
  let appBus: Pick<AppBus, "publish">;
  let component: AppNotificationToastComponent;

  function toast(overrides: Partial<AppNotificationToast> = {}): AppNotificationToast {
    return {
      id: 1,
      pillId: 1,
      phase: "open",
      shownAt: now,
      header: "Done",
      type: "info",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    shownToast.set(undefined);
    appNotificationChannelService = {
      appNotificationToast: shownToast,
      dismissAppNotificationToast: vi.fn(),
    };
    appBus = { publish: vi.fn() };
    component = new AppNotificationToastComponent(
      appNotificationChannelService as AppNotificationChannelService,
      appBus as AppBus,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the shown toast, and nothing without one", () => {
    expect(component.appNotificationToasts()).toEqual([]);

    const shown = toast({ type: "success" });
    shownToast.set(shown);

    expect(component.appNotificationToasts()).toEqual([shown]);
  });

  it("dismisses the toast through the notification channel service", () => {
    component.dismiss(toast());

    expect(appNotificationChannelService.dismissAppNotificationToast).toHaveBeenCalledOnce();
  });

  it("opens the notification target and closes the toast", () => {
    component.openTarget(toast({ target }));

    expect(appBus.publish).toHaveBeenCalledWith({
      type: "OpenNotificationTarget",
      payload: target,
    });
    expect(appNotificationChannelService.dismissAppNotificationToast).toHaveBeenCalledOnce();
  });

  it("ignores missing targets", () => {
    component.openTarget(toast());

    expect(appBus.publish).not.toHaveBeenCalled();
    expect(appNotificationChannelService.dismissAppNotificationToast).not.toHaveBeenCalled();
  });

  it("ignores clicks right after a notification has taken the pill over", () => {
    const takenOver = toast({ id: 2, pillId: 1, target });

    vi.advanceTimersByTime(499);
    component.openTarget(takenOver);
    component.dismiss(takenOver);

    expect(appBus.publish).not.toHaveBeenCalled();
    expect(appNotificationChannelService.dismissAppNotificationToast).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    component.openTarget(takenOver);

    expect(appBus.publish).toHaveBeenCalledOnce();
    expect(appNotificationChannelService.dismissAppNotificationToast).toHaveBeenCalledOnce();
  });
});
