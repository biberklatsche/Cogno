import {ChangeDetectionStrategy, Component, Signal} from '@angular/core';
import {Icon} from "../icons/+model/icon";
import {IconComponent} from "../icons/icon/icon.component";
import {AppNotificationToast, AppNotificationToastId, Notification, NotificationService} from "./+state/notification.service";

@Component({
    selector: 'app-notification-toast-stack',
    standalone: true,
    imports: [IconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (appNotificationToasts().length > 0) {
            <section class="toast-stack" aria-live="polite" aria-atomic="false">
                @for (toast of appNotificationToasts(); track toast.id) {
                    <article class="toast" [class]="toast.type">
                        <app-icon [name]="getIcon(toast.type)"></app-icon>
                        <div class="content">
                            <header class="title">{{ toast.header }}</header>
                            @if (toast.body) {
                                <p class="message">{{ toast.body }}</p>
                            }
                        </div>
                        <button
                            class="button icon-button"
                            type="button"
                            aria-label="Dismiss notification"
                            (click)="dismiss(toast.id)">
                            <app-icon [name]="'mdiClose'"></app-icon>
                        </button>
                    </article>
                }
            </section>
        }
    `,
    styles: [`
        .toast-stack {
            position: fixed;
            right: 12px;
            bottom: 12px;
            z-index: 20;
            display: flex;
            flex-direction: column-reverse;
            gap: 8px;
            max-width: min(420px, calc(100vw - 24px));
            pointer-events: none;
        }

        .toast {
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px;
            border-left: 3px solid var(--accent, var(--color-blue));
            border-radius: 6px;
            background: var(--background-color-20l);
            box-shadow: 0 6px 14px color-mix(in srgb, var(--color-black) 35%, transparent);
            min-width: min(360px, calc(100vw - 24px));
            animation: toast-in 0.16s ease-out;
        }

        .content {
            min-width: 0;
            flex: 1 1 auto;
        }

        .title {
            font-weight: 600;
            line-height: 1.2;
            margin-bottom: 2px;
        }

        .message {
            margin: 0;
            line-height: 1.3;
            opacity: 0.9;
            white-space: pre-wrap;
        }

        .icon-button {
            transform: scale(0.7);
            margin-top: -6px;
            margin-right: -6px;
        }

        .toast.info {
            --accent: var(--color-blue);
        }

        .toast.success {
            --accent: var(--color-green);
        }

        .toast.warning {
            --accent: var(--color-yellow);
        }

        .toast.error {
            --accent: var(--color-red);
        }

        @keyframes toast-in {
            from {
                opacity: 0;
                transform: translateY(8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `]
})
export class AppNotificationToastStackComponent {
    readonly appNotificationToasts: Signal<AppNotificationToast[]>;

    constructor(private notificationService: NotificationService) {
        this.appNotificationToasts = this.notificationService.appNotificationToasts;
    }

    dismiss(toastId: AppNotificationToastId): void {
        this.notificationService.dismissAppNotificationToast(toastId);
    }

    getIcon(type?: Notification['type']): Icon {
        switch (type) {
            case 'success':
                return 'mdiCheckCircle';
            case 'warning':
                return 'mdiAlert';
            case 'error':
                return 'mdiAlert';
            case 'info':
            default:
                return 'mdiInformation';
        }
    }
}
