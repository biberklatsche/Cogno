import { Component, Signal } from "@angular/core";
import { Notification, NotificationId, NotificationService } from "./notification.service";

@Component({
  selector: "app-notification-side",
  standalone: true,
  template: `
    <section class="notification-header">
      <strong>Notifications</strong>
      <button class="button" type="button" [disabled]="notifications().length === 0" (click)="clearAll()">
        Clear all
      </button>
    </section>

    <section class="notification-list">
      @for (notification of notifications(); track notification.id) {
        <section class="notification" [class]="notification.type">
          <div class="content">
            <header class="title">{{ notification.header }}</header>
            @if (notification.body) {
              <main class="message">{{ notification.body }}</main>
            }
            <small class="timestamp">{{ toRelativeTime(notification.timestamp) }}</small>
          </div>
          @if (notification.count > 1) {
            <div class="count" title="Occurrences">{{ notification.count }}</div>
          }
          <button class="button icon-button" (click)="remove(notification.id)">x</button>
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
        font-size: 0.9rem;
        overflow: hidden;
        width: 100%;
      }

      .notification-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0.25rem 0.25rem 0.5rem;
      }

      .notification-list {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 0 0.25rem 0.25rem;
      }

      .notification {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        position: relative;
        padding: 0.5rem 0.75rem 0.5rem 0.5rem;
        margin: 0 0 0.25rem;
        border-left: 3px solid transparent;
        border-radius: 4px;
        background-color: var(--background-color-20l);
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
        font-size: 1.2rem;
        margin-bottom: 2px;
        color: var(--accent, var(--color-foreground));
      }

      .message {
        opacity: 0.9;
        line-height: 1.3;
        white-space: pre-wrap;
      }

      .icon-button {
        transform: scale(0.8);
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
  readonly notifications: Signal<Notification[]>;

  constructor(private readonly notificationService: NotificationService) {
    this.notifications = this.notificationService.notifications;
  }

  remove(notificationId: NotificationId): void {
    this.notificationService.remove(notificationId);
  }

  clearAll(): void {
    this.notificationService.clear();
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
