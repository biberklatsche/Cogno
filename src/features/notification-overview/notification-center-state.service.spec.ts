import type { ApplicationConfigurationPort } from "@cogno/core/api/application-configuration-port";
import type { NotificationCenterPort } from "@cogno/core/api/notification-center-port";
import type { NotificationEventPayloadContract } from "@cogno/shared/domain";
import { Subject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { NotificationCenterStateService } from "./notification-center-state.service";

describe("NotificationCenterStateService", () => {
  let notificationEvents: Subject<NotificationEventPayloadContract>;
  let overviewMaxItems = 30;
  let service: NotificationCenterStateService;

  beforeEach(() => {
    notificationEvents = new Subject<NotificationEventPayloadContract>();
    overviewMaxItems = 30;

    const notificationCenterPort = {
      notificationEvents$: notificationEvents.asObservable(),
    } as NotificationCenterPort;
    const configPort = {
      getConfiguration: () => ({
        feature: { notification_overview: { overview: { max_items: overviewMaxItems } } },
      }),
    } as unknown as ApplicationConfigurationPort;

    service = new NotificationCenterStateService(
      notificationCenterPort,
      configPort,
      getDestroyRef(),
    );
    service.start();
  });

  it("collects notifications while started", () => {
    notificationEvents.next({ header: "Header", body: "Body", type: "info" });

    const notifications = service.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].header).toBe("Header");
    expect(notifications[0].count).toBe(1);
  });

  it("increments the count for duplicate notifications", () => {
    notificationEvents.next({ header: "Header", body: "Body" });
    notificationEvents.next({ header: "Header", body: "Body" });

    const notifications = service.notifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].count).toBe(2);
  });

  it("is unread from the first notification until the panel is opened", () => {
    expect(service.unread()).toBe(false);
    notificationEvents.next({ header: "Badge" });
    expect(service.unread()).toBe(true);

    service.markRead();
    expect(service.unread()).toBe(false);
  });

  it("drops everything and ignores notifications once stopped", () => {
    notificationEvents.next({ header: "Kept" });
    service.stop();
    notificationEvents.next({ header: "Ignored" });

    expect(service.notifications()).toHaveLength(0);
    expect(service.unread()).toBe(false);
  });

  it("removes one notification or all of them", () => {
    notificationEvents.next({ header: "One" });
    notificationEvents.next({ header: "Two" });
    const one = service.notifications().find((notification) => notification.header === "One");
    service.remove(one?.id ?? "");
    expect(service.notifications().map((notification) => notification.header)).toEqual(["Two"]);

    service.clear();
    expect(service.notifications()).toHaveLength(0);
    expect(service.unread()).toBe(false);
  });

  it("keeps only the configured number of notifications", () => {
    overviewMaxItems = 2;

    notificationEvents.next({ header: "First", timestamp: new Date("2025-01-01T10:00:00.000Z") });
    notificationEvents.next({ header: "Second", timestamp: new Date("2025-01-01T11:00:00.000Z") });
    notificationEvents.next({ header: "Third", timestamp: new Date("2025-01-01T12:00:00.000Z") });

    expect(service.notifications().map((notification) => notification.header)).toEqual([
      "Third",
      "Second",
    ]);
  });
});
