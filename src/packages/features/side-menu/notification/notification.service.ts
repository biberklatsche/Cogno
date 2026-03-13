import { DestroyRef, Injectable, Signal, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FeatureModeContract } from "@cogno/core-sdk";
import { NotificationTypeContract } from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import { ConfigService } from "@cogno/app/config/+state/config.service";

export type NotificationId = number;
export type NotificationType = NotificationTypeContract;

export type Notification = {
  readonly id: NotificationId;
  readonly header: string;
  readonly body?: string;
  readonly type: NotificationType;
  readonly count: number;
  readonly timestamp: Date;
};

@Injectable({ providedIn: "root" })
export class NotificationService {
  private notificationEnabled = true;
  private sideMenuIconUpdater?: (iconName: string) => void;

  private readonly notificationMapSignal = signal<Record<NotificationId, Notification>>({});

  readonly notifications: Signal<Notification[]> = computed(() =>
    Object.values(this.notificationMapSignal()).sort(
      (leftNotification, rightNotification) => rightNotification.timestamp.getTime() - leftNotification.timestamp.getTime(),
    ),
  );

  constructor(
    private readonly appBus: AppBus,
    private readonly configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    this.appBus
      .on$({ path: ["notification"], type: "Notification" })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEvent) => {
        this.handleNotificationEvent(notificationEvent.payload);
      });
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
    this.sideMenuIconUpdater?.("mdiBell");
  }

  getNotificationCount(): number {
    return this.notifications().length;
  }

  private handleNotificationEvent(notificationEventPayload: unknown): void {
    if (!this.notificationEnabled) {
      return;
    }
    if (!isNotificationPayload(notificationEventPayload)) {
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

      return this.trimNotificationMap(nextNotificationMap, this.getMaxNotifications());
    });

    this.sideMenuIconUpdater?.("mdiBellBadge");
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

  private createNotificationId(header: string, body?: string): number {
    const text = `${header}|${body ?? ""}`;
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  private getMaxNotifications(): number {
    return this.configService.config.notification?.overview?.max_items ?? 30;
  }
}

function isNotificationPayload(
  notificationPayload: unknown,
): notificationPayload is {
  readonly body?: string;
  readonly header: string;
  readonly timestamp?: Date;
  readonly type?: NotificationTypeContract;
} {
  return (
    typeof notificationPayload === "object" &&
    notificationPayload !== null &&
    typeof (notificationPayload as { header?: unknown }).header === "string"
  );
}
