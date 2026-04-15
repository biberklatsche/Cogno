import type {
  NotificationCenterPortContract,
  NotificationEventPayloadContract,
} from "@cogno/core-api";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { NotificationCenterStateService } from "./notification-center-state.service";

describe("NotificationCenterStateService", () => {
  let notificationEventSubject: BehaviorSubject<NotificationEventPayloadContract>;
  let overviewMaxItems = 30;
  let notificationCenterStateService: NotificationCenterStateService;
  let latestIconName: string | undefined;

  beforeEach(() => {
    notificationEventSubject = new BehaviorSubject<NotificationEventPayloadContract>({
      header: "Initial",
    });
    overviewMaxItems = 30;

    const notificationCenterPort = {
      notificationEvents$: notificationEventSubject.asObservable(),
      getOverviewMaxItems: () => overviewMaxItems,
    } as NotificationCenterPortContract;

    notificationCenterStateService = new NotificationCenterStateService(
      notificationCenterPort,
      getDestroyRef(),
    );
    notificationCenterStateService.setSideMenuIconUpdater((iconName) => {
      latestIconName = iconName;
    });
    notificationCenterStateService.clear();
    latestIconName = undefined;
  });

  it("collects notifications from the app bus", () => {
    publishNotification({ header: "Header", body: "Body", type: "info" });

    const notifications = notificationCenterStateService.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].header).toBe("Header");
    expect(notifications[0].count).toBe(1);
  });

  it("increments the count for duplicate notifications", () => {
    publishNotification({ header: "Header", body: "Body" });
    publishNotification({ header: "Header", body: "Body" });

    const notifications = notificationCenterStateService.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].count).toBe(2);
  });

  it("updates the side menu icon to the badge variant when a notification arrives", () => {
    publishNotification({ header: "Badge" });

    expect(latestIconName).toBe("mdiBellBadge");
  });

  it("resets the icon on side menu open", () => {
    notificationCenterStateService.handleSideMenuOpen();

    expect(latestIconName).toBe("mdiBell");
  });

  it("stops processing notifications when the feature mode is off", () => {
    notificationCenterStateService.handleSideMenuModeChange("off");
    publishNotification({ header: "Ignored" });

    expect(notificationCenterStateService.notifications()).toHaveLength(0);
  });

  it("keeps only the configured number of notifications", () => {
    overviewMaxItems = 2;

    publishNotification({ header: "First", timestamp: new Date("2025-01-01T10:00:00.000Z") });
    publishNotification({ header: "Second", timestamp: new Date("2025-01-01T11:00:00.000Z") });
    publishNotification({ header: "Third", timestamp: new Date("2025-01-01T12:00:00.000Z") });

    expect(
      notificationCenterStateService.notifications().map((notification) => notification.header),
    ).toEqual(["Third", "Second"]);
  });

  function publishNotification(payload: {
    readonly body?: string;
    readonly header: string;
    readonly timestamp?: Date;
    readonly type?: "error" | "success" | "warning" | "info";
  }): void {
    notificationEventSubject.next(payload);
  }
});
