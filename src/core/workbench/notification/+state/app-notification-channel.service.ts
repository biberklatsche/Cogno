import { Injectable, Signal, signal } from "@angular/core";
import { resolveLimit } from "@cogno/core/api/contributions";
import {
  NotificationChannelContract,
  NotificationChannelDispatchRequestContract,
} from "@cogno/shared/domain";
import { AppNotificationToast, AppNotificationToastPhase } from "./app-notification-toast.models";

/** The shape arrives, then the pill opens. */
const OPEN_DELAY_MS = 450;
/** The text goes and the pill shrinks back to the shape. */
const CLOSING_MS = 340;
/** The shape leaves the screen. */
const EXIT_MS = 220;

/**
 * Shows one toast at a time: the notification overview keeps every
 * notification, so a new one takes over the pill that is on screen.
 */
@Injectable({ providedIn: "root" })
export class AppNotificationChannelService implements NotificationChannelContract {
  readonly displayName = "App";
  readonly id = "app";
  readonly sortOrder = 300;

  private appNotificationToastIdCounter = 0;
  /** How long the toast stays open; Infinity keeps it until it is dismissed. */
  private openDurationMs = Number.POSITIVE_INFINITY;
  private phaseTimer?: ReturnType<typeof setTimeout>;
  private readonly appNotificationToastSignal = signal<AppNotificationToast | undefined>(undefined);

  readonly appNotificationToast: Signal<AppNotificationToast | undefined> =
    this.appNotificationToastSignal.asReadonly();

  dispatch(notificationChannelDispatchRequest: NotificationChannelDispatchRequestContract): void {
    // `unlimited` resolves to Infinity: the toast stays until it is dismissed.
    const durationSeconds = resolveLimit(
      notificationChannelDispatchRequest.settings["duration_seconds"],
      5,
    );
    if (durationSeconds <= 0) {
      return;
    }

    const notification = notificationChannelDispatchRequest.notification;
    this.appNotificationToastIdCounter += 1;
    const toastId = this.appNotificationToastIdCounter;
    // A pill that is already leaving is not brought back; the new toast gets its own.
    const shownToast = this.appNotificationToastSignal();
    const reusedPill = shownToast && shownToast.phase !== "exit" ? shownToast : undefined;

    this.openDurationMs = durationSeconds * 1000;
    this.appNotificationToastSignal.set({
      body: notification.body,
      header: notification.header,
      id: toastId,
      phase: reusedPill && reusedPill.phase !== "enter" ? "open" : "enter",
      pillId: reusedPill?.pillId ?? toastId,
      shownAt: Date.now(),
      target: notification.target,
      type: notification.type ?? "info",
    });
    // A pill that is still arriving opens when it was going to: a burst must not hold it shut.
    if (reusedPill?.phase !== "enter") {
      this.scheduleNextPhase();
    }
  }

  dismissAppNotificationToast(): void {
    const phase = this.appNotificationToastSignal()?.phase;
    if (phase === "enter" || phase === "open") {
      this.enterPhase("closing");
    }
  }

  private enterPhase(phase: AppNotificationToastPhase): void {
    this.appNotificationToastSignal.update((toast) => toast && { ...toast, phase });
    this.scheduleNextPhase();
  }

  private scheduleNextPhase(): void {
    clearTimeout(this.phaseTimer);
    this.phaseTimer = undefined;

    switch (this.appNotificationToastSignal()?.phase) {
      case "enter":
        this.phaseTimer = setTimeout(() => this.enterPhase("open"), OPEN_DELAY_MS);
        break;
      case "open":
        if (Number.isFinite(this.openDurationMs)) {
          this.phaseTimer = setTimeout(() => this.enterPhase("closing"), this.openDurationMs);
        }
        break;
      case "closing":
        this.phaseTimer = setTimeout(() => this.enterPhase("exit"), CLOSING_MS);
        break;
      case "exit":
        this.phaseTimer = setTimeout(() => this.appNotificationToastSignal.set(undefined), EXIT_MS);
        break;
    }
  }
}
