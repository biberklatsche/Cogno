import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ErrorReporter } from "@cogno/core/infrastructure/error/error-reporter";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { NotificationChannelRegistry } from "@cogno/core/workbench/notification/+state/notification-channel-registry";
import {
  NotificationChannelContract,
  NotificationChannelSettingsContract,
  NotificationChannelsContract,
  NotificationReplyChannelContract,
  NotificationTargetContract,
} from "@cogno/shared/domain";

@Injectable({ providedIn: "root" })
export class NotificationDispatchService {
  constructor(
    private readonly appBus: AppBus,
    private readonly notificationChannelRegistry: NotificationChannelRegistry,
    private readonly configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    this.configService.config$.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      void this.reconcileReplyChannels();
    });

    this.appBus
      .on$("Notification")
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

    for (const notificationChannel of this.notificationChannelRegistry.getChannels()) {
      if (!this.isNotificationChannelEnabled(notificationChannel, notificationPayload.channels)) {
        continue;
      }
      // Isolate each channel: one that throws or hangs is skipped for this
      // notification, the others still run (ARCHITECTURE.md 6.1).
      await this.dispatchToChannel(notificationChannel, notificationPayload);
    }
  }

  private async dispatchToChannel(
    notificationChannel: NotificationChannelContract,
    notificationPayload: NotificationPayload,
  ): Promise<void> {
    try {
      await withTimeout(
        notificationChannel.dispatch({
          notification: notificationPayload,
          settings: this.getNotificationChannelSettings(notificationChannel.id),
        }),
        NOTIFICATION_CHANNEL_TIMEOUT_MS,
      );
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "NotificationDispatchService",
        context: { operation: "dispatch", channelId: notificationChannel.id },
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
    const notificationsConfiguration = this.configService.config.notification?.channel as
      | Readonly<Record<string, unknown>>
      | undefined;
    const settings = notificationsConfiguration?.[notificationChannelId];
    if (!isRecord(settings)) {
      return {};
    }
    return settings;
  }

  private async reconcileReplyChannels(): Promise<void> {
    for (const notificationChannel of this.notificationChannelRegistry.getChannels()) {
      if (!isNotificationReplyChannel(notificationChannel)) {
        continue;
      }

      const notificationChannelSettings = this.getNotificationChannelSettings(
        notificationChannel.id,
      );
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
    for (const notificationChannel of this.notificationChannelRegistry.getChannels()) {
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
  readonly target?: NotificationTargetContract;
  readonly terminalId?: string;
  readonly timestamp?: Date;
  readonly type?: "error" | "success" | "warning" | "info";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A channel gets this long to dispatch before it is considered stuck. */
const NOTIFICATION_CHANNEL_TIMEOUT_MS = 5_000;

/** Resolve `value`, but reject if it has not settled within `timeoutMs`. */
async function withTimeout(value: Promise<void> | void, timeoutMs: number): Promise<void> {
  if (!(value instanceof Promise)) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Channel did not respond within ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });
  try {
    await Promise.race([value, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function isNotificationReplyChannel(
  notificationChannel: NotificationChannelContract,
): notificationChannel is NotificationReplyChannelContract {
  return (
    typeof (notificationChannel as NotificationReplyChannelContract).startReceivingReplies ===
      "function" ||
    typeof (notificationChannel as NotificationReplyChannelContract).stopReceivingReplies ===
      "function"
  );
}
