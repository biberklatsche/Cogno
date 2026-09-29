import { describe, expect, it } from "vitest";
import { NotificationInboxUseCase } from "./notification-inbox.use-case";

describe("NotificationInboxUseCase", () => {
  it("aggregates duplicate notifications", () => {
    let state = NotificationInboxUseCase.createInitialState();
    state = NotificationInboxUseCase.handleNotificationEvent(
      state,
      { header: "Header", body: "Body" },
      10,
    ).state;
    state = NotificationInboxUseCase.handleNotificationEvent(
      state,
      { header: "Header", body: "Body" },
      10,
    ).state;

    const notifications = NotificationInboxUseCase.getNotifications(state);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].count).toBe(2);
  });

  it("clears notifications when the collection is turned off", () => {
    let state = NotificationInboxUseCase.createInitialState();
    state = NotificationInboxUseCase.handleNotificationEvent(state, { header: "Header" }, 10).state;
    state = NotificationInboxUseCase.setCollectionMode(state, "off");

    expect(NotificationInboxUseCase.getNotifications(state)).toHaveLength(0);
  });

  it("keeps only the newest configured number of notifications", () => {
    let state = NotificationInboxUseCase.createInitialState();
    state = NotificationInboxUseCase.handleNotificationEvent(
      state,
      { header: "First", timestamp: new Date("2025-01-01T10:00:00.000Z") },
      2,
    ).state;
    state = NotificationInboxUseCase.handleNotificationEvent(
      state,
      { header: "Second", timestamp: new Date("2025-01-01T11:00:00.000Z") },
      2,
    ).state;
    state = NotificationInboxUseCase.handleNotificationEvent(
      state,
      { header: "Third", timestamp: new Date("2025-01-01T12:00:00.000Z") },
      2,
    ).state;

    expect(
      NotificationInboxUseCase.getNotifications(state).map((notification) => notification.header),
    ).toEqual(["Third", "Second"]);
  });
});
