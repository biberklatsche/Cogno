import { Injectable, Signal, signal } from "@angular/core";
import type {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
  NotificationTypeContract,
} from "@cogno/core-api";
import type { AppNotificationToast, AppNotificationToastId } from "./app-notification-toast.models";

@Injectable({ providedIn: "root" })
export class AppNotificationChannelService implements NotificationChannelContract {
  readonly displayName = "App";
  readonly id = "app";
  readonly sortOrder = 300;

  private appNotificationToastIdCounter = 0;
  private readonly appNotificationToastTimerById = new Map<
    AppNotificationToastId,
    ReturnType<typeof setTimeout>
  >();
  private readonly appNotificationToastsSignal = signal<AppNotificationToast[]>([]);

  readonly appNotificationToasts: Signal<AppNotificationToast[]> =
    this.appNotificationToastsSignal.asReadonly();

  dispatch(notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract): void {
    const durationSeconds = readNumberSetting(
      notificationChannelDispatchRequest.settings,
      "duration_seconds",
      5,
    );
    if (durationSeconds <= 0) {
      return;
    }

    const toastId = this.showAppNotificationToast({
      body: notificationChannelDispatchRequest.notification.body,
      header: notificationChannelDispatchRequest.notification.header,
      timestamp: notificationChannelDispatchRequest.notification.timestamp ?? new Date(),
      type: notificationChannelDispatchRequest.notification.type ?? "info",
    });

    const timer = setTimeout(() => {
      this.dismissAppNotificationToast(toastId);
    }, durationSeconds * 1000);
    this.appNotificationToastTimerById.set(toastId, timer);
  }

  dismissAppNotificationToast(toastId: AppNotificationToastId): void {
    this.clearAppNotificationToastTimer(toastId);
    this.appNotificationToastsSignal.update((appNotificationToasts) =>
      appNotificationToasts.filter((appNotificationToast) => appNotificationToast.id !== toastId),
    );
  }

  clear(): void {
    for (const timer of this.appNotificationToastTimerById.values()) {
      clearTimeout(timer);
    }
    this.appNotificationToastTimerById.clear();
    this.appNotificationToastsSignal.set([]);
  }

  private showAppNotificationToast(
    toast: Omit<AppNotificationToast, "id">,
  ): AppNotificationToastId {
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
}

function readNumberSetting(
  settings: Readonly<Record<string, unknown>>,
  key: string,
  fallbackValue: number,
): number {
  const value = settings[key];
  if (typeof value !== "number") {
    return fallbackValue;
  }
  return value;
}



