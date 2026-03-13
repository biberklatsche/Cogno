import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import type { Config } from "@cogno/app/config/+models/config";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  let appBus: AppBus;
  let configService: ConfigServiceMock;
  let notificationService: NotificationService;
  let latestIconName: string | undefined;

  beforeEach(() => {
    appBus = new AppBus();
    configService = new ConfigServiceMock();
    configService.setConfig({
      notification: {
        overview: {
          max_items: 30,
        },
      },
    } as Config);

    notificationService = new NotificationService(appBus, configService, getDestroyRef());
    notificationService.setSideMenuIconUpdater((iconName) => {
      latestIconName = iconName;
    });
    notificationService.clear();
    latestIconName = undefined;
  });

  it("collects notifications from the app bus", () => {
    publishNotification({ header: "Header", body: "Body", type: "info" });

    const notifications = notificationService.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].header).toBe("Header");
    expect(notifications[0].count).toBe(1);
  });

  it("increments the count for duplicate notifications", () => {
    publishNotification({ header: "Header", body: "Body" });
    publishNotification({ header: "Header", body: "Body" });

    const notifications = notificationService.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].count).toBe(2);
  });

  it("updates the side menu icon to the badge variant when a notification arrives", () => {
    publishNotification({ header: "Badge" });

    expect(latestIconName).toBe("mdiBellBadge");
  });

  it("resets the icon on side menu open", () => {
    notificationService.handleSideMenuOpen();

    expect(latestIconName).toBe("mdiBell");
  });

  it("stops processing notifications when the feature mode is off", () => {
    notificationService.handleSideMenuModeChange("off");
    publishNotification({ header: "Ignored" });

    expect(notificationService.notifications()).toHaveLength(0);
  });

  it("keeps only the configured number of notifications", () => {
    configService.setConfig({
      notification: {
        overview: {
          max_items: 2,
        },
      },
    } as Config);

    publishNotification({ header: "First", timestamp: new Date("2025-01-01T10:00:00.000Z") });
    publishNotification({ header: "Second", timestamp: new Date("2025-01-01T11:00:00.000Z") });
    publishNotification({ header: "Third", timestamp: new Date("2025-01-01T12:00:00.000Z") });

    expect(notificationService.notifications().map((notification) => notification.header)).toEqual([
      "Third",
      "Second",
    ]);
  });

  function publishNotification(payload: {
    readonly body?: string;
    readonly header: string;
    readonly timestamp?: Date;
    readonly type?: "error" | "success" | "warning" | "info";
  }): void {
    appBus.publish({
      path: ["notification"],
      type: "Notification",
      payload,
    });
  }
});
