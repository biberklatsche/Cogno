import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import type {
  NotificationChannelContract,
  NotificationReplyChannelContract,
  NotificationChannelSettingsContract,
  NotificationChannelsContract,
} from "@cogno/core-api";
import { AppBus } from "../../app-bus/app-bus";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ConfigService } from "../../config/+state/config.service";

@Injectable({ providedIn: "root" })
export class NotificationDispatchService {
  constructor(
    private readonly appBus: AppBus,
    private readonly appWiringService: AppWiringService,
    private readonly configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    this.configService.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        void this.reconcileReplyChannels();
      });

    this.appBus
      .on$({ path: ["notification"], type: "Notification" })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((notificationEvent) => {
        void this.dispatchNotification(notificationEvent.payload);
      });
    destroyRef.onDestroy(() => {
      this.stopReplyChannels();
    });
  }

  private async dispatchNotification(notificationPayload: unknown): Promise<void> {
    if (!isNotificationPayload(notificationPayload)) {
      return;
    }

    for (const notificationChannel of this.appWiringService.getNotificationChannels()) {
      if (!this.isNotificationChannelEnabled(notificationChannel, notificationPayload.channels)) {
        continue;
      }

      await notificationChannel.dispatch({
        notification: notificationPayload,
        settings: this.getNotificationChannelSettings(notificationChannel.id),
      });
    }
  }

  private isNotificationChannelEnabled(
    notificationChannel: NotificationChannelContract,
    notificationChannels: Partial<NotificationChannelsContract> | undefined,
  ): boolean {
    if (notificationChannel.isAvailable && !notificationChannel.isAvailable()) {
      return false;
    }

    const notificationChannelSettings = this.getNotificationChannelSettings(notificationChannel.id);
    const channelAvailable = notificationChannelSettings.available ?? true;
    const channelEnabled = notificationChannelSettings.enabled ?? false;
    const eventChannelEnabled = notificationChannels?.[notificationChannel.id];

    if (!channelAvailable) {
      return false;
    }

    return eventChannelEnabled ?? channelEnabled;
  }

  private getNotificationChannelSettings(
    notificationChannelId: string,
  ): NotificationChannelSettingsContract & Readonly<Record<string, unknown>> {
    const notificationsConfiguration = this.configService.config.notifications as
      | Readonly<Record<string, unknown>>
      | undefined;
    const settings = notificationsConfiguration?.[notificationChannelId];
    if (!isRecord(settings)) {
      return {};
    }
    return settings;
  }

  private async reconcileReplyChannels(): Promise<void> {
    for (const notificationChannel of this.appWiringService.getNotificationChannels()) {
      if (!isNotificationReplyChannel(notificationChannel)) {
        continue;
      }

      const notificationChannelSettings = this.getNotificationChannelSettings(notificationChannel.id);
      const channelAvailable = notificationChannelSettings.available ?? true;
      const channelEnabled = notificationChannelSettings.enabled ?? false;

      if (channelAvailable && channelEnabled) {
        await notificationChannel.startReceivingReplies?.(notificationChannelSettings);
        continue;
      }

      await notificationChannel.stopReceivingReplies?.();
    }
  }

  private stopReplyChannels(): void {
    for (const notificationChannel of this.appWiringService.getNotificationChannels()) {
      if (isNotificationReplyChannel(notificationChannel)) {
        void notificationChannel.stopReceivingReplies?.();
      }
    }
  }
}

function isNotificationPayload(
  notificationPayload: unknown,
): notificationPayload is NotificationPayload {
  if (!isRecord(notificationPayload) || !hasStringHeader(notificationPayload)) {
    return false;
  }

  return true;
}

function hasStringHeader(
  notificationPayload: Record<string, unknown>,
): notificationPayload is Record<string, unknown> & { readonly header: string } {
  const notificationPayloadCandidate = notificationPayload as { readonly header?: unknown };
  return typeof notificationPayloadCandidate.header === "string";
}

type NotificationPayload = {
  readonly body?: string;
  readonly channels?: Partial<NotificationChannelsContract>;
  readonly header: string;
  readonly source?: string;
  readonly terminalId?: string;
  readonly timestamp?: Date;
  readonly type?: "error" | "success" | "warning" | "info";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotificationReplyChannel(
  notificationChannel: NotificationChannelContract,
): notificationChannel is NotificationReplyChannelContract {
  return (
    typeof (notificationChannel as NotificationReplyChannelContract).startReceivingReplies === "function"
    || typeof (notificationChannel as NotificationReplyChannelContract).stopReceivingReplies === "function"
  );
}
