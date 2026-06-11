import { NotificationChannelsContract, NotificationDefinitionContract } from "@cogno/core-api";
import { NotificationPreferencesState } from "./notification-preferences-state";

export interface ChannelDefinitionContract {
  readonly id: string;
  readonly defaultEnabled?: boolean;
}

export class NotificationPreferencesUseCase {
  static createInitialState(
    notificationDefinitions: ReadonlyArray<NotificationDefinitionContract>,
    channelDefinitions: ReadonlyArray<ChannelDefinitionContract>,
  ): NotificationPreferencesState {
    const notifications: Record<string, boolean> = {};
    for (const notificationDefinition of notificationDefinitions) {
      notifications[notificationDefinition.id] = notificationDefinition.defaultEnabled ?? false;
    }

    const channels: Record<string, boolean> = {};
    for (const channelDefinition of channelDefinitions) {
      channels[channelDefinition.id] = channelDefinition.defaultEnabled ?? false;
    }

    return { notifications, channels };
  }

  static toggleNotification(
    state: NotificationPreferencesState,
    notificationId: string,
  ): NotificationPreferencesState {
    return {
      ...state,
      notifications: {
        ...state.notifications,
        [notificationId]: !(state.notifications[notificationId] ?? false),
      },
    };
  }

  static toggleChannel(
    state: NotificationPreferencesState,
    channelId: string,
  ): NotificationPreferencesState {
    return {
      ...state,
      channels: {
        ...state.channels,
        [channelId]: !(state.channels[channelId] ?? false),
      },
    };
  }

  static isNotificationEnabled(state: NotificationPreferencesState, notificationId: string): boolean {
    return state.notifications[notificationId] ?? false;
  }

  static shouldNotify(state: NotificationPreferencesState, notificationId: string): boolean {
    if (!NotificationPreferencesUseCase.isNotificationEnabled(state, notificationId)) {
      return false;
    }

    return Object.values(state.channels).some(Boolean);
  }

  static getActiveChannels(state: NotificationPreferencesState): NotificationChannelsContract {
    return state.channels;
  }
}
