import { describe, expect, it } from "vitest";
import { NotificationCenterUseCase } from "./notification-center.use-case";

describe("NotificationCenterUseCase", () => {
  it("collects notifications and increments duplicates", () => {
    let state = NotificationCenterUseCase.createInitialState();
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "Header", body: "Body" }, 10).state;
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "Header", body: "Body" }, 10).state;

    const notifications = NotificationCenterUseCase.getNotifications(state);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].count).toBe(2);
  });

  it("clears notifications when the feature mode is off", () => {
    let state = NotificationCenterUseCase.createInitialState();
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "Header" }, 10).state;
    state = NotificationCenterUseCase.setFeatureMode(state, "off");

    expect(NotificationCenterUseCase.getNotifications(state)).toHaveLength(0);
  });

  it("keeps only the configured maximum number of notifications", () => {
    let state = NotificationCenterUseCase.createInitialState();
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "First", timestamp: new Date("2025-01-01T10:00:00.000Z") }, 2).state;
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "Second", timestamp: new Date("2025-01-01T11:00:00.000Z") }, 2).state;
    state = NotificationCenterUseCase.handleNotificationEvent(state, { header: "Third", timestamp: new Date("2025-01-01T12:00:00.000Z") }, 2).state;

    expect(NotificationCenterUseCase.getNotifications(state).map((notification) => notification.header)).toEqual([
      "Third",
      "Second",
    ]);
  });
});
