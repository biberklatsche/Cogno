import { DestroyRef, Inject, Injectable, Signal, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FeatureModeContract } from "@cogno/core-sdk";
import {
  NotificationChannelsContract,
  NotificationEventPayloadContract,
  NotificationHostPortContract,
  NotificationSettingsContract,
  NotificationTypeContract,
  notificationHostPortToken,
} from "@cogno/core-sdk";

export type NotificationId = number;
export type NotificationType = NotificationTypeContract;
export type AppNotificationToastId = number;

export type Notification = {
  readonly id: NotificationId;
  readonly header: string;
  readonly body?: string;
  readonly type: NotificationType;
  readonly count: number;
  readonly timestamp: Date;
};

export type AppNotificationToast = {
  readonly id: AppNotificationToastId;
  readonly header: string;
  readonly body?: string;
  readonly type: NotificationType;
  readonly timestamp: Date;
};

const defaultNotificationSettings: NotificationSettingsContract = {
  appEnabled: true,
  osEnabled: false,
  telegramEnabled: false,
  appAvailable: true,
  osAvailable: true,
  telegramAvailable: true,
  appNotificationDurationSeconds: 5,
  maxNotifications: 30,
};

@Injectable({ providedIn: "root" })
export class NotificationService {
  private notificationEnabled = true;
  private sideMenuIconUpdater?: (iconName: string) => void;

  private appNotificationToastIdCounter = 0;
  private readonly appNotificationToastTimerById = new Map<AppNotificationToastId, ReturnType<typeof setTimeout>>();

  private readonly notificationMapSignal = signal<Record<NotificationId, Notification>>({});
  private readonly appNotificationToastsSignal = signal<AppNotificationToast[]>([]);
  private readonly notificationSettingsSignal = signal<NotificationSettingsContract>(defaultNotificationSettings);

  readonly notifications: Signal<Notification[]> = computed(() =>
    Object.values(this.notificationMapSignal()).sort(
      (leftNotification, rightNotification) => rightNotification.timestamp.getTime() - leftNotification.timestamp.getTime(),
    ),
  );
  readonly appNotificationToasts: Signal<AppNotificationToast[]> = this.appNotificationToastsSignal.asReadonly();

  constructor(
    @Inject(notificationHostPortToken)
    private readonly notificationHostPort: NotificationHostPortContract,
    destroyRef: DestroyRef,
  ) {
    this.notificationHostPort.notificationSettings$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationSettings) => {
        this.notificationSettingsSignal.set(notificationSettings);
      });

    this.notificationHostPort.notificationEvent$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEventPayload) => {
        this.handleNotificationEvent(notificationEventPayload);
      });

    destroyRef.onDestroy(() => this.clearAllAppNotificationToasts());
  }

  setSideMenuIconUpdater(sideMenuIconUpdater: (iconName: string) => void): void {
    this.sideMenuIconUpdater = sideMenuIconUpdater;
  }

  handleSideMenuModeChange(mode: FeatureModeContract): void {
    this.notificationEnabled = mode !== "off";
    if (!this.notificationEnabled) {
      this.clear();
    }
  }

  handleSideMenuOpen(): void {
    this.sideMenuIconUpdater?.("mdiBell");
  }

  handleSideMenuClose(): void {
    // no-op for now
  }

  remove(notificationId: NotificationId): void {
    this.notificationMapSignal.update((notificationMap) => {
      const nextNotificationMap = { ...notificationMap };
      delete nextNotificationMap[notificationId];
      return nextNotificationMap;
    });
  }

  clear(): void {
    this.notificationMapSignal.set({});
    this.clearAllAppNotificationToasts();
    this.sideMenuIconUpdater?.("mdiBell");
  }

  dismissAppNotificationToast(toastId: AppNotificationToastId): void {
    this.clearAppNotificationToastTimer(toastId);
    this.appNotificationToastsSignal.update((appNotificationToasts) =>
      appNotificationToasts.filter((appNotificationToast) => appNotificationToast.id !== toastId),
    );
  }

  getNotificationCount(): number {
    return this.notifications().length;
  }

  private handleNotificationEvent(notificationEventPayload: NotificationEventPayloadContract): void {
    if (!this.notificationEnabled) {
      return;
    }

    const notificationChannels = this.resolveNotificationChannels(notificationEventPayload.channels);
    if (!notificationChannels.app && !notificationChannels.os && !notificationChannels.telegram) {
      return;
    }

    const timestamp = notificationEventPayload.timestamp ?? new Date();
    const notificationId = this.createNotificationId(notificationEventPayload.header, notificationEventPayload.body);

    this.notificationMapSignal.update((notificationMap) => {
      const nextNotificationMap = { ...notificationMap };
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
          type: notificationEventPayload.type ?? "info",
          count: 1,
          timestamp,
        };
      }

      return this.trimNotificationMap(nextNotificationMap, this.notificationSettingsSignal().maxNotifications);
    });

    this.sideMenuIconUpdater?.("mdiBellBadge");

    if (notificationChannels.os) {
      void this.notificationHostPort.sendOsNotification(notificationEventPayload.header, notificationEventPayload.body);
    }

    if (notificationChannels.app) {
      const appNotificationDurationSeconds = this.notificationSettingsSignal().appNotificationDurationSeconds;
      if (appNotificationDurationSeconds <= 0) {
        return;
      }

      const toastId = this.showAppNotificationToast({
        header: notificationEventPayload.header,
        body: notificationEventPayload.body,
        type: notificationEventPayload.type ?? "info",
        timestamp,
      });

      const timer = setTimeout(() => {
        this.dismissAppNotificationToast(toastId);
      }, appNotificationDurationSeconds * 1000);
      this.appNotificationToastTimerById.set(toastId, timer);
    }
  }

  private resolveNotificationChannels(
    eventChannels?: Partial<NotificationChannelsContract>,
  ): NotificationChannelsContract {
    const notificationSettings = this.notificationSettingsSignal();

    return {
      app: notificationSettings.appAvailable && (eventChannels?.app ?? notificationSettings.appEnabled),
      os: notificationSettings.osAvailable && (eventChannels?.os ?? notificationSettings.osEnabled),
      telegram: notificationSettings.telegramAvailable && (eventChannels?.telegram ?? notificationSettings.telegramEnabled),
    };
  }

  private trimNotificationMap(
    notificationMap: Record<NotificationId, Notification>,
    maxNotifications: number,
  ): Record<NotificationId, Notification> {
    const notificationList = Object.values(notificationMap);
    if (notificationList.length <= maxNotifications) {
      return notificationMap;
    }

    const sortedByAgeAscending = [...notificationList].sort(
      (leftNotification, rightNotification) => leftNotification.timestamp.getTime() - rightNotification.timestamp.getTime(),
    );
    const overflowCount = sortedByAgeAscending.length - maxNotifications;
    const trimmedNotificationMap = { ...notificationMap };

    for (let overflowIndex = 0; overflowIndex < overflowCount; overflowIndex += 1) {
      delete trimmedNotificationMap[sortedByAgeAscending[overflowIndex].id];
    }

    return trimmedNotificationMap;
  }

  private showAppNotificationToast(toast: Omit<AppNotificationToast, "id">): AppNotificationToastId {
    this.appNotificationToastIdCounter += 1;
    const toastId = this.appNotificationToastIdCounter;
    const nextToast: AppNotificationToast = { ...toast, id: toastId };

    this.appNotificationToastsSignal.update((appNotificationToasts) => {
      const nextToastList = [...appNotificationToasts, nextToast];
      while (nextToastList.length > 3) {
        const removedToast = nextToastList.shift();
        if (removedToast) {
          this.clearAppNotificationToastTimer(removedToast.id);
        }
      }
      return nextToastList;
    });

    return toastId;
  }

  private clearAppNotificationToastTimer(toastId: AppNotificationToastId): void {
    const timer = this.appNotificationToastTimerById.get(toastId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.appNotificationToastTimerById.delete(toastId);
  }

  private clearAllAppNotificationToasts(): void {
    for (const timer of this.appNotificationToastTimerById.values()) {
      clearTimeout(timer);
    }
    this.appNotificationToastTimerById.clear();
    this.appNotificationToastsSignal.set([]);
  }

  private createNotificationId(header: string, body?: string): number {
    const text = `${header}|${body ?? ""}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }
}
