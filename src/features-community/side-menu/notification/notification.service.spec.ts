import { beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import {
  NotificationEventPayloadContract,
  NotificationHostPortContract,
  NotificationSettingsContract,
} from "@cogno/core-sdk";
import { NotificationService } from "@cogno/community-features/side-menu/notification/notification.service";
import { getDestroyRef } from "../../__test__/destroy-ref";

describe("NotificationService", () => {
  let notificationService: NotificationService;
  let notificationEventSubject: BehaviorSubject<NotificationEventPayloadContract>;
  let notificationSettingsSubject: BehaviorSubject<NotificationSettingsContract>;
  let sendOsNotificationMock: ReturnType<typeof vi.fn>;
  let latestIconName: string | undefined;

  beforeEach(() => {
    notificationEventSubject = new BehaviorSubject<NotificationEventPayloadContract>({
      header: "init",
      body: "init",
    });
    notificationSettingsSubject = new BehaviorSubject<NotificationSettingsContract>({
      appEnabled: true,
      osEnabled: false,
      telegramEnabled: false,
      appAvailable: true,
      osAvailable: true,
      telegramAvailable: true,
      appNotificationDurationSeconds: 5,
      maxNotifications: 30,
    });
    sendOsNotificationMock = vi.fn().mockResolvedValue(undefined);

    const notificationHostPort: NotificationHostPortContract = {
      notificationEvent$: notificationEventSubject.asObservable(),
      notificationSettings$: notificationSettingsSubject.asObservable(),
      sendOsNotification: sendOsNotificationMock,
    };

    notificationService = new NotificationService(notificationHostPort, getDestroyRef());
    notificationService.setSideMenuIconUpdater((iconName) => {
      latestIconName = iconName;
    });
    notificationService.clear();
    latestIconName = undefined;
  });

  it("collects notifications from host stream", () => {
    notificationEventSubject.next({ header: "Header", body: "Body", type: "info" });

    const notifications = notificationService.notifications();
    expect(notifications.length).toBe(1);
    expect(notifications[0].header).toBe("Header");
    expect(notifications[0].count).toBe(1);
  });

  it("increments count for duplicate notifications", () => {
    notificationEventSubject.next({ header: "Header", body: "Body" });
    notificationEventSubject.next({ header: "Header", body: "Body" });

    const notifications = notificationService.notifications();
    expect(notifications.length).toBe(1);
    expect(notifications[0].count).toBe(2);
  });

  it("updates icon to badge when a notification arrives", () => {
    notificationEventSubject.next({ header: "Badge" });
    expect(latestIconName).toBe("mdiBellBadge");
  });

  it("resets icon on side menu open", () => {
    notificationService.handleSideMenuOpen();
    expect(latestIconName).toBe("mdiBell");
  });

  it("sends OS notification when channel is enabled", async () => {
    notificationSettingsSubject.next({
      ...notificationSettingsSubject.value,
      appEnabled: false,
      osEnabled: true,
    });
    notificationEventSubject.next({ header: "OS", body: "Body" });
    expect(sendOsNotificationMock).toHaveBeenCalledWith("OS", "Body");
  });

  it("creates app toast and auto dismisses it", () => {
    vi.useFakeTimers();
    notificationSettingsSubject.next({
      ...notificationSettingsSubject.value,
      appNotificationDurationSeconds: 1,
    });

    notificationEventSubject.next({ header: "Toast", body: "Body" });
    expect(notificationService.appNotificationToasts().length).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(notificationService.appNotificationToasts().length).toBe(0);
    vi.useRealTimers();
  });

  it("stops processing when feature mode is off", () => {
    notificationService.handleSideMenuModeChange("off");
    notificationEventSubject.next({ header: "Ignored" });
    expect(notificationService.notifications().length).toBe(0);
  });
});


