import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { NotificationDefinitionContract } from "@cogno/core-api";
import { NotificationPreferencesState } from "@cogno/core-domain";
import { IconComponent } from "../../icons/icon/icon.component";

export interface NotificationChannelOption {
  readonly id: string;
  readonly displayName: string;
}

@Component({
  selector: "app-notification-preferences-menu",
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="notification-preferences">
      @if (notificationDefinitions.length > 0) {
        <div class="notification-preferences__section">
          <span class="notification-preferences__heading">{{ notificationsLabel }}</span>
          @for (notificationDefinition of notificationDefinitions; track notificationDefinition.id) {
            <button
              type="button"
              class="notification-preferences__item"
              role="menuitemcheckbox"
              [attr.aria-checked]="isNotificationEnabled(notificationDefinition.id)"
              (click)="onNotificationToggle(notificationDefinition.id)">
              <span
                class="notification-preferences__checkbox"
                [class.notification-preferences__checkbox--checked]="isNotificationEnabled(notificationDefinition.id)">
                @if (isNotificationEnabled(notificationDefinition.id)) {
                  <app-icon name="mdiCheck"></app-icon>
                }
              </span>
              <span class="notification-preferences__label">{{ notificationDefinition.label }}</span>
            </button>
          }
        </div>
      }

      @if (channels.length > 0) {
        <div class="notification-preferences__section">
          <span class="notification-preferences__heading">{{ channelsLabel }}</span>
          @for (channel of channels; track channel.id) {
            <button
              type="button"
              class="notification-preferences__item"
              role="menuitemcheckbox"
              [attr.aria-checked]="isChannelEnabled(channel.id)"
              (click)="onChannelToggle(channel.id)">
              <span
                class="notification-preferences__checkbox"
                [class.notification-preferences__checkbox--checked]="isChannelEnabled(channel.id)">
                @if (isChannelEnabled(channel.id)) {
                  <app-icon name="mdiCheck"></app-icon>
                }
              </span>
              <span class="notification-preferences__label">{{ channel.displayName }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .notification-preferences {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 12rem;
    }

    .notification-preferences__section + .notification-preferences__section {
      margin-top: 0.4rem;
      padding-top: 0.4rem;
      border-top: 1px solid var(--background-color-20l);
    }

    .notification-preferences__heading {
      display: block;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
    }

    .notification-preferences__item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      border: 0;
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
      padding: 0.35rem 0.6rem;
    }

    .notification-preferences__item:hover,
    .notification-preferences__item:focus-visible {
      background: var(--background-color-20l);
      outline: none;
    }

    .notification-preferences__checkbox {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 1rem;
      height: 1rem;
      border: 1px solid currentColor;
      border-radius: 0.2rem;
      opacity: 0.8;

      app-icon {
        width: 0.85rem;
        height: 0.85rem;
      }
    }

    .notification-preferences__checkbox--checked {
      opacity: 1;
      background: var(--highlight-color);
      border-color: var(--highlight-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferencesMenuComponent {
  @Input() notificationDefinitions: ReadonlyArray<NotificationDefinitionContract> = [];
  @Input() channels: ReadonlyArray<NotificationChannelOption> = [];
  @Input() state!: NotificationPreferencesState;
  @Input() notificationsLabel = "Notifications";
  @Input() channelsLabel = "Channels";

  @Output() readonly notificationToggled = new EventEmitter<string>();
  @Output() readonly channelToggled = new EventEmitter<string>();

  isNotificationEnabled(notificationId: string): boolean {
    return this.state.notifications[notificationId] ?? false;
  }

  isChannelEnabled(channelId: string): boolean {
    return this.state.channels[channelId] ?? false;
  }

  onNotificationToggle(notificationId: string): void {
    this.notificationToggled.emit(notificationId);
  }

  onChannelToggle(channelId: string): void {
    this.channelToggled.emit(channelId);
  }
}
