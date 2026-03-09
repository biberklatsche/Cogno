import {DestroyRef, computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {ConfigService} from "../../config/+state/config.service";
import {FeatureMode} from "../../config/+models/config";
import {Hash} from '../../common/hash/hash';
import {KeybindService} from "../../keybinding/keybind.service";
import {createSideMenuFeature, SideMenuFeature} from "../../menu/side-menu/+state/side-menu-feature";
import {NotificationOs} from "../../_tauri/notification";
import {NotificationEvent} from "../+bus/events";
import { CoreHostWiringService } from "../../core-host/core-host-wiring.service";
import { sideMenuFeatureIds } from "../../menu/side-menu/+state/side-menu-feature-ids";

type NotificationChannels = {
    app: boolean;
    os: boolean;
    telegram: boolean;
};

export type NotificationId = number;
export type NotificationType = 'error' | 'success' | 'warning' | 'info';
export type AppNotificationToastId = number;

export type Notification = {
    id: NotificationId;
    header: string;
    body?: string;
    type?: NotificationType,
    count: number;
    timestamp: Date;
}

export type AppNotificationToast = {
    id: AppNotificationToastId;
    header: string;
    body?: string;
    type: NotificationType;
    timestamp: Date;
};

@Injectable({providedIn: 'root'})
export class NotificationService {
    private readonly feature: SideMenuFeature;
    private notificationSubscription?: Subscription;
    private appNotificationToastIdCounter: AppNotificationToastId = 0;
    private readonly appNotificationToastTimerById: Map<AppNotificationToastId, ReturnType<typeof setTimeout>> = new Map();

    private _notifications: WritableSignal<Record<NotificationId, Notification>> = signal({});
    private _appNotificationToasts: WritableSignal<AppNotificationToast[]> = signal([]);

    readonly notifications: Signal<Notification[]> = computed(() => {
        return Object
            .values(this._notifications())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
    readonly appNotificationToasts: Signal<AppNotificationToast[]> = this._appNotificationToasts.asReadonly();

    constructor(
        sideMenuService: SideMenuService,
        private bus: AppBus,
        private configService: ConfigService,
        keybinds: KeybindService,
        destroyRef: DestroyRef,
    ) {
        const notificationSideMenuDefinition = CoreHostWiringService
            .getInstance()
            .getRequiredSideMenuFeatureDefinitionById(sideMenuFeatureIds.notification);

        this.feature = createSideMenuFeature(
            notificationSideMenuDefinition,
            {
                onModeChange: (mode) => this.handleModeChange(mode),
                onOpen: () => this.handleOpen(),
                onFocus: () => this.registerKeybindListener(),
                onBlur: () => this.unregisterKeybindListener(),
                onClose: () => this.handleClose(),
            },
            { sideMenuService, bus, configService: this.configService, keybinds, destroyRef }
        );

        // Start listening to notifications immediately (even when side menu is closed)
        this.initNotificationListener();
        destroyRef.onDestroy(() => this.clearAllAppNotificationToasts());
    }

    private handleModeChange(mode: FeatureMode): void {
        if (mode === 'off') {
            this.stopNotificationListener();
        } else {
            // Ensure listener is active when feature is enabled
            this.initNotificationListener();
        }
    }

    private handleOpen(): void {
        // Reset icon to normal bell (clear badge indicator)
        this.feature.updateIcon('mdiBell');
    }

    private handleClose(): void {
        this.unregisterKeybindListener();
    }

    private registerKeybindListener(): void {
        this.feature.registerKeybindListener(
            ['Escape'],
            () => this.feature.close()
        );
    }

    private unregisterKeybindListener(): void {
        this.feature.unregisterKeybindListener();
    }

    private initNotificationListener(): void {
        // Don't create duplicate subscriptions
        if (this.notificationSubscription) return;

        this.notificationSubscription = this.bus
            .on$({type: 'Notification', path: ['notification']})
            .subscribe((event: NotificationEvent) => {
                this.handleNotificationEvent(event);
            });
    }

    private stopNotificationListener(): void {
        this.notificationSubscription?.unsubscribe();
        this.notificationSubscription = undefined;
    }

    private handleNotificationEvent(event: NotificationEvent): void {
        if (!event.payload) return;
        const payload = event.payload;
        const notificationChannels = this.getEffectiveNotificationChannels(payload.channels);
        if (!notificationChannels.app && !notificationChannels.os && !notificationChannels.telegram) {
            return;
        }
        const maxNotifications = this.getMaxNotifications();

        const id = Hash.create(payload.header + payload.body);

        // Update icon to show badge
        this.feature.updateIcon('mdiBellBadge');

        this._notifications.update((currentNotifications) => {
            const nextNotifications = {...currentNotifications};

            if (!nextNotifications[id]) {
                // New notification
                nextNotifications[id] = {
                    id: id,
                    body: payload.body,
                    header: payload.header,
                    type: payload.type ?? 'info',
                    count: 1,
                    timestamp: payload.timestamp ?? new Date()
                };
            } else {
                // Duplicate notification - increment count
                const notification = nextNotifications[id];
                notification.count++;
                notification.timestamp = payload.timestamp ?? new Date();
                nextNotifications[id] = notification;
            }

            return this.trimNotificationList(nextNotifications, maxNotifications);
        });

        if (notificationChannels.os) {
            void NotificationOs.send(payload.header, payload.body);
        }

        if (notificationChannels.app) {
            const appNotificationDurationSeconds = this.getAppNotificationDurationSeconds();
            if (appNotificationDurationSeconds <= 0) {
                return;
            }

            const toastId = this.showAppNotificationToast({
                header: payload.header,
                body: payload.body,
                type: payload.type ?? 'info',
                timestamp: payload.timestamp ?? new Date(),
            });

            const timer = setTimeout(() => {
                this.dismissAppNotificationToast(toastId);
            }, appNotificationDurationSeconds * 1000);
            this.appNotificationToastTimerById.set(toastId, timer);
        }
    }

    private getEffectiveNotificationChannels(eventChannels?: Partial<NotificationChannels>): NotificationChannels {
        const defaults = this.getDefaultNotificationChannels();
        const availability = this.getAvailableNotificationChannels();

        return {
            app: availability.app && (eventChannels?.app ?? defaults.app),
            os: availability.os && (eventChannels?.os ?? defaults.os),
            telegram: availability.telegram && (eventChannels?.telegram ?? defaults.telegram),
        };
    }

    private getAvailableNotificationChannels(): NotificationChannels {
        try {
            const notificationConfig = this.configService.config.notification;
            return {
                app: notificationConfig?.app?.available ?? true,
                os: notificationConfig?.os?.available ?? true,
                telegram: notificationConfig?.telegram?.available ?? true,
            };
        } catch {
            return {
                app: true,
                os: true,
                telegram: true,
            };
        }
    }

    private getDefaultNotificationChannels(): NotificationChannels {
        try {
            const notificationConfig = this.configService.config.notification;
            const appEnabled = notificationConfig?.app?.enabled ?? true;
            const osEnabled = notificationConfig?.os?.enabled ?? false;
            const telegramEnabled = notificationConfig?.telegram?.enabled ?? false;

            return {app: appEnabled, os: osEnabled, telegram: telegramEnabled};
        } catch {
            return {app: true, os: false, telegram: false};
        }
    }

    private getAppNotificationDurationSeconds(): number {
        try {
            const notificationConfig = this.configService.config.notification;
            const configuredDuration = notificationConfig?.app?.notification_duration_seconds
                ?? notificationConfig?.app_notification_duration_seconds;
            return configuredDuration ?? 5;
        } catch {
            return 5;
        }
    }

    private getMaxNotifications(): number {
        try {
            const notificationConfig = this.configService.config.notification;
            const configuredLimit = notificationConfig?.max_notifications_in_overview
                ?? notificationConfig?.max_notifications;
            return configuredLimit ?? 30;
        } catch {
            return 30;
        }
    }

    private trimNotificationList(notifications: Record<NotificationId, Notification>, maxNotifications: number): Record<NotificationId, Notification> {
        const notificationList = Object.values(notifications);
        if (notificationList.length <= maxNotifications) {
            return notifications;
        }

        const sortedByAgeAscending = [...notificationList].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
        const overflowCount = sortedByAgeAscending.length - maxNotifications;
        const nextNotifications = {...notifications};

        for (let index = 0; index < overflowCount; index++) {
            const notificationToRemove = sortedByAgeAscending[index];
            delete nextNotifications[notificationToRemove.id];
        }

        return nextNotifications;
    }

    private showAppNotificationToast(toast: Omit<AppNotificationToast, 'id'>): AppNotificationToastId {
        const toastId = this.nextAppNotificationToastId();
        const nextToast: AppNotificationToast = {...toast, id: toastId};

        this._appNotificationToasts.update((currentToasts) => {
            const toastList = [...currentToasts, nextToast];
            while (toastList.length > 3) {
                const removedToast = toastList.shift();
                if (removedToast) {
                    this.clearAppNotificationToastTimer(removedToast.id);
                }
            }
            return toastList;
        });

        return toastId;
    }

    private nextAppNotificationToastId(): AppNotificationToastId {
        this.appNotificationToastIdCounter += 1;
        return this.appNotificationToastIdCounter;
    }

    private clearAppNotificationToastTimer(toastId: AppNotificationToastId): void {
        const timer = this.appNotificationToastTimerById.get(toastId);
        if (!timer) return;
        clearTimeout(timer);
        this.appNotificationToastTimerById.delete(toastId);
    }

    private clearAllAppNotificationToasts(): void {
        for (const timer of this.appNotificationToastTimerById.values()) {
            clearTimeout(timer);
        }
        this.appNotificationToastTimerById.clear();
        this._appNotificationToasts.set([]);
    }

    // Public API

    public remove(notificationId: NotificationId): void {
        this._notifications.update(notifications => {
            const next = {...notifications};
            delete next[notificationId];
            return next;
        });
    }

    public clear(): void {
        this._notifications.set({});
        this.clearAllAppNotificationToasts();
        this.feature.updateIcon('mdiBell');
    }

    public dismissAppNotificationToast(toastId: AppNotificationToastId): void {
        this.clearAppNotificationToastTimer(toastId);
        this._appNotificationToasts.update((currentToasts) => {
            return currentToasts.filter((toast) => toast.id !== toastId);
        });
    }

    public getNotificationCount(): number {
        return Object.keys(this._notifications()).length;
    }
}
