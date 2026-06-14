import { ContextMenuItem, NotificationDefinitionContract } from "@cogno/core-api";
import { NotificationPreferencesUseCase } from "./notification-preferences.use-case";
import { NotificationPreferencesState } from "./notification-preferences-state";

export interface NotificationPreferencesMenuChannel {
  readonly id: string;
  readonly displayName: string;
}

export interface BuildNotificationPreferencesMenuItemsOptions {
  notificationDefinitions: ReadonlyArray<NotificationDefinitionContract>;
  channels: ReadonlyArray<NotificationPreferencesMenuChannel>;
  state: NotificationPreferencesState;
  notificationsLabel?: string;
  channelsLabel?: string;
  // When true, hide the entire menu if there are no channels available.
  hideWhenNoChannels?: boolean;
  onToggleNotification: (notificationId: string) => NotificationPreferencesState;
  onToggleChannel: (channelId: string) => NotificationPreferencesState;
}

export function buildNotificationPreferencesMenuItems(
  options: BuildNotificationPreferencesMenuItemsOptions,
): ContextMenuItem[] {
  const {
    notificationDefinitions,
    channels,
    state,
    notificationsLabel = "Notifications",
    channelsLabel = "Channels",
    hideWhenNoChannels = false,
    onToggleNotification,
    onToggleChannel,
  } = options;

  if (hideWhenNoChannels && channels.length === 0) {
    return [];
  }

  const items: ContextMenuItem[] = [];

  if (notificationDefinitions.length > 0) {
    items.push({ header: true, label: notificationsLabel });
    for (const notificationDefinition of notificationDefinitions) {
      items.push({
        label: notificationDefinition.label,
        toggle: true,
        toggled: NotificationPreferencesUseCase.isNotificationEnabled(
          state,
          notificationDefinition.id,
        ),
        closeOnSelect: false,
        action: (item?: ContextMenuItem) => {
          const newState = onToggleNotification(notificationDefinition.id);
          if (item?.toggle) {
            item.toggled = NotificationPreferencesUseCase.isNotificationEnabled(
              newState,
              notificationDefinition.id,
            );
          }
        },
      });
    }
  }

  if (channels.length > 0) {
    items.push({ separator: true });
    items.push({ header: true, label: channelsLabel });
    for (const channel of channels) {
      items.push({
        label: channel.displayName,
        toggle: true,
        toggled: state.channels[channel.id] ?? false,
        closeOnSelect: false,
        action: (item?: ContextMenuItem) => {
          const newState = onToggleChannel(channel.id);
          if (item?.toggle) {
            item.toggled = newState.channels[channel.id] ?? false;
          }
        },
      });
    }
  }

  return items;
}
