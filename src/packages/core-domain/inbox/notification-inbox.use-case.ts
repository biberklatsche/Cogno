import {
  FeatureModeContract,
  NotificationCenterItemContract,
  NotificationCenterItemIdContract,
  NotificationEventPayloadContract,
} from "@cogno/core-api";
import { NotificationInboxState } from "./notification-inbox-state";

export interface NotificationInboxEventResult {
  readonly shouldShowBadge: boolean;
  readonly state: NotificationInboxState;
}

export class NotificationInboxUseCase {
  static createInitialState(): NotificationInboxState {
    return {
      enabled: true,
      notificationMap: {},
    };
  }

  static setCollectionMode(
    state: NotificationInboxState,
    mode: FeatureModeContract,
  ): NotificationInboxState {
    const enabled = mode !== "off";
    if (enabled) {
      return {
        ...state,
        enabled: true,
      };
    }
    return {
      enabled: false,
      notificationMap: {},
    };
  }

  static remove(
    state: NotificationInboxState,
    notificationId: NotificationCenterItemIdContract,
  ): NotificationInboxState {
    const nextNotificationMap = { ...state.notificationMap };
    delete nextNotificationMap[notificationId];
    return {
      ...state,
      notificationMap: nextNotificationMap,
    };
  }

  static clear(state: NotificationInboxState): NotificationInboxState {
    return {
      ...state,
      notificationMap: {},
    };
  }

  static getNotifications(state: NotificationInboxState): NotificationCenterItemContract[] {
    return Object.values(state.notificationMap).sort(
      (leftNotification, rightNotification) =>
        rightNotification.timestamp.getTime() - leftNotification.timestamp.getTime(),
    );
  }

  static getNotificationCount(state: NotificationInboxState): number {
    return Object.keys(state.notificationMap).length;
  }

  static handleNotificationEvent(
    state: NotificationInboxState,
    notificationEventPayload: unknown,
    maxNotifications: number,
  ): NotificationInboxEventResult {
    if (
      !state.enabled ||
      !NotificationInboxUseCase.isNotificationPayload(notificationEventPayload)
    ) {
      return {
        shouldShowBadge: false,
        state,
      };
    }

    const timestamp = notificationEventPayload.timestamp ?? new Date();
    const notificationId = NotificationInboxUseCase.createNotificationId(
      notificationEventPayload.header,
      notificationEventPayload.body,
      notificationEventPayload.target,
    );
    const nextNotificationMap = { ...state.notificationMap };
    const existingNotification = nextNotificationMap[notificationId];

    if (existingNotification) {
      nextNotificationMap[notificationId] = {
        ...existingNotification,
        count: existingNotification.count + 1,
        timestamp,
      };
    } else {
      nextNotificationMap[notificationId] = {
        id: notificationId,
        header: notificationEventPayload.header,
        body: notificationEventPayload.body,
        target: notificationEventPayload.target,
        type: notificationEventPayload.type ?? "info",
        count: 1,
        timestamp,
      };
    }

    return {
      shouldShowBadge: true,
      state: {
        ...state,
        notificationMap: NotificationInboxUseCase.trimNotificationMap(
          nextNotificationMap,
          maxNotifications,
        ),
      },
    };
  }

  private static trimNotificationMap(
    notificationMap: Record<NotificationCenterItemIdContract, NotificationCenterItemContract>,
    maxNotifications: number,
  ): Record<NotificationCenterItemIdContract, NotificationCenterItemContract> {
    const notificationList = Object.values(notificationMap);
    if (notificationList.length <= maxNotifications) {
      return notificationMap;
    }

    const sortedByAgeAscending = [...notificationList].sort(
      (leftNotification, rightNotification) =>
        leftNotification.timestamp.getTime() - rightNotification.timestamp.getTime(),
    );
    const overflowCount = sortedByAgeAscending.length - maxNotifications;
    const trimmedNotificationMap = { ...notificationMap };

    for (let overflowIndex = 0; overflowIndex < overflowCount; overflowIndex += 1) {
      delete trimmedNotificationMap[sortedByAgeAscending[overflowIndex].id];
    }

    return trimmedNotificationMap;
  }

  private static createNotificationId(
    header: string,
    body?: string,
    target?: NotificationEventPayloadContract["target"],
  ): number {
    const text = `${header}|${body ?? ""}|${target?.workspaceId ?? ""}|${target?.tabId ?? ""}|${target?.terminalId ?? ""}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  private static isNotificationPayload(
    notificationPayload: unknown,
  ): notificationPayload is NotificationEventPayloadContract {
    return (
      typeof notificationPayload === "object" &&
      notificationPayload !== null &&
      typeof (notificationPayload as { header?: unknown }).header === "string"
    );
  }
}
