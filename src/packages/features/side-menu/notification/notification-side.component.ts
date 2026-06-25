import { Component, Signal } from "@angular/core";
import { NotificationCenterItemContract, NotificationCenterItemIdContract } from "@cogno/core-api";
import { IconComponent, TooltipDirective } from "@cogno/core-ui";
import { NotificationCenterStateService } from "./notification-center-state.service";

@Component({
  selector: "app-notification-side",
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  template: `
    <section class="notification-header">
      <div></div>
      <button class="button" type="button" [disabled]="notifications().length === 0" (click)="clearAll()">
        Clear
      </button>
    </section>

    <section class="notification-list">
      @for (notification of notifications(); track notification.id) {
        <section
          class="notification"
          [class]="notification.type"
          (click)="openTarget(notification)"
        >
          <div class="content">
            <header class="title">{{ notification.header }}</header>
            @if (notification.body) {
              <main class="message">{{ notification.body }}</main>
            }
            <small class="timestamp">{{ toRelativeTime(notification.timestamp) }}</small>
          </div>
          @if (notification.count > 1) {
            <div class="count" [appTooltip]="'Occurrences'">{{ notification.count }}</div>
          }
          <button class="button icon-button" type="button" (click)="remove(notification.id); $event.stopPropagation()">
            <app-icon name="mdiClose"></app-icon>
          </button>
        </section>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        margin: 0;
        padding: 0.25rem 0 0;
        font-size: 0.85rem;
        overflow: hidden;
        width: 100%;
        gap: 1rem;
      }

      .notification-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .notification-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }

      .notification {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        position: relative;
        padding: 0.5rem 0.75rem 0.5rem 0.5rem;
        margin: 0 0 0.25rem;
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-left: 3px solid transparent;
        border-radius: 4px;
        transition: background 0.1s;
      }

      .notification:hover {
        background-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      }

      .timestamp {
        opacity: 0.5;
        align-self: end;
      }

      .content {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .title {
        font-weight: 600;
        line-height: 1.2;
        font-size: 1rem;
        margin-bottom: 2px;
        color: var(--accent, var(--color-foreground));
      }

      .message {
        opacity: 0.9;
        line-height: 1.3;
        white-space: pre-wrap;
      }

      .icon-button {
        position: absolute;
        top: 3px;
        right: 3px;
      }

      .count {
        position: absolute;
        top: 6px;
        right: 3rem;
        font-size: 0.75rem;
        padding: 0 6px;
        line-height: 18px;
        min-width: 18px;
        text-align: center;
        border-radius: 9px;
        background-color: var(--color-black);
        color: var(--color-white);
      }

      .notification.info {
        --accent: var(--color-blue);
        border-left-color: var(--color-blue);
      }

      .notification.success {
        --accent: var(--color-green);
        border-left-color: var(--color-green);
      }

      .notification.warning {
        --accent: var(--color-yellow);
        border-left-color: var(--color-yellow);
      }

      .notification.error {
        --accent: var(--color-red);
        border-left-color: var(--color-red);
      }
    `,
  ],
})
export class NotificationSideComponent {
  readonly notifications: Signal<NotificationCenterItemContract[]>;

  constructor(private readonly notificationCenterStateService: NotificationCenterStateService) {
    this.notifications = this.notificationCenterStateService.notifications;
  }

  remove(notificationId: NotificationCenterItemIdContract): void {
    this.notificationCenterStateService.remove(notificationId);
  }

  clearAll(): void {
    this.notificationCenterStateService.clear();
  }

  openTarget(notification: NotificationCenterItemContract): void {
    if (!notification.target) {
      return;
    }

    this.notificationCenterStateService.openTarget(notification.target);
  }

  toRelativeTime(timestamp: Date): string {
    const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (secondsAgo < 60) {
      return "just now";
    }
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) {
      return `${minutesAgo}m ago`;
    }
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) {
      return `${hoursAgo}h ago`;
    }
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  }
}
