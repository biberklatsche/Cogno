import { NotificationDefinitionContract } from "@cogno/core-api";
import { describe, expect, it } from "vitest";
import { ChannelDefinitionContract, NotificationPreferencesUseCase } from "./notification-preferences.use-case";

const notificationDefinitions: ReadonlyArray<NotificationDefinitionContract> = [
  { id: "working", label: "Working", defaultEnabled: true },
  { id: "question", label: "Question" },
];

const channelDefinitions: ReadonlyArray<ChannelDefinitionContract> = [
  { id: "app", defaultEnabled: true },
  { id: "os" },
];

describe("NotificationPreferencesUseCase", () => {
  it("creates initial state from notification and channel defaults", () => {
    const state = NotificationPreferencesUseCase.createInitialState(
      notificationDefinitions,
      channelDefinitions,
    );

    expect(state.notifications).toEqual({ working: true, question: false });
    expect(state.channels).toEqual({ app: true, os: false });
  });

  it("toggles notifications and channels independently", () => {
    let state = NotificationPreferencesUseCase.createInitialState(
      notificationDefinitions,
      channelDefinitions,
    );

    state = NotificationPreferencesUseCase.toggleNotification(state, "question");
    state = NotificationPreferencesUseCase.toggleChannel(state, "os");

    expect(state.notifications["question"]).toBe(true);
    expect(state.channels["os"]).toBe(true);
    expect(state.notifications["working"]).toBe(true);
    expect(state.channels["app"]).toBe(true);
  });

  it("should not notify when the notification is disabled", () => {
    const state = NotificationPreferencesUseCase.createInitialState(
      notificationDefinitions,
      channelDefinitions,
    );

    expect(NotificationPreferencesUseCase.shouldNotify(state, "question")).toBe(false);
  });

  it("should not notify when no channel is enabled", () => {
    let state = NotificationPreferencesUseCase.createInitialState(
      [{ id: "working", label: "Working", defaultEnabled: true }],
      [{ id: "app" }, { id: "os" }],
    );

    expect(NotificationPreferencesUseCase.shouldNotify(state, "working")).toBe(false);

    state = NotificationPreferencesUseCase.toggleChannel(state, "app");
    expect(NotificationPreferencesUseCase.shouldNotify(state, "working")).toBe(true);
  });

  it("returns the active channels for dispatching a notification", () => {
    const state = NotificationPreferencesUseCase.createInitialState(
      notificationDefinitions,
      channelDefinitions,
    );

    expect(NotificationPreferencesUseCase.getActiveChannels(state)).toEqual({
      app: true,
      os: false,
    });
  });
});
