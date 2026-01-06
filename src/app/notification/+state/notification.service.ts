import {DestroyRef, computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {ConfigService} from "../../config/+state/config.service";
import {FeatureMode} from "../../config/+models/config";
import {NotificationSideComponent} from "../notification-side/notification-side.component";
import {Hash} from '../../common/hash/hash';
import {KeybindService} from "../../keybinding/keybind.service";
import {createSideMenuFeature, SideMenuFeature} from "../../menu/side-menu/+state/side-menu-feature";

export type NotificationId = number;
export type NotificationType = 'error' | 'success' | 'warning' | 'info';

export type Notification = {
    id: NotificationId;
    header: string;
    body?: string;
    type?: NotificationType,
    count: number;
    timestamp: Date;
}

@Injectable({providedIn: 'root'})
export class NotificationService {
    private readonly feature: SideMenuFeature;
    private notificationSubscription?: Subscription;

    private _notifications: WritableSignal<Record<NotificationId, Notification>> = signal({});

    readonly notifications: Signal<Notification[]> = computed(() => {
        return Object.values(this._notifications());
    });

    constructor(
        private sideMenuService: SideMenuService,
        private bus: AppBus,
        config: ConfigService,
        keybinds: KeybindService,
        destroyRef: DestroyRef,
    ) {
        this.feature = createSideMenuFeature(
            {
                label: 'Notification',
                icon: 'mdiBell',
                actionName: 'open_notification',
                component: NotificationSideComponent,
                configPath: 'notification',
            },
            {
                onModeChange: (mode) => this.handleModeChange(mode),
                onOpen: () => this.handleOpen(),
                onClose: () => this.handleClose(),
            },
            { sideMenuService, bus, configService: config, keybinds, destroyRef }
        );

        // Start listening to notifications immediately (even when side menu is closed)
        this.initNotificationListener();
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

        // Register Escape key to close
        this.feature.registerKeybindListener(
            ['Escape'],
            () => this.feature.close()
        );
    }

    private handleClose(): void {
        this.feature.unregisterKeybindListener();
    }

    private initNotificationListener(): void {
        // Don't create duplicate subscriptions
        if (this.notificationSubscription) return;

        this.notificationSubscription = this.bus
            .on$({type: 'Notification', path: ['notification']})
            .subscribe(event => {
                this.handleNotificationEvent(event);
            });
    }

    private stopNotificationListener(): void {
        this.notificationSubscription?.unsubscribe();
        this.notificationSubscription = undefined;
    }

    private handleNotificationEvent(event: any): void {
        if (!event.payload) return;

        const id = Hash.create(event.payload.header + event.payload.body);

        // Update icon to show badge
        this.feature.updateIcon('mdiBellBadge');

        this._notifications.update(notifications => {
            if (!notifications[id]) {
                // New notification
                notifications[id] = {
                    id: id,
                    body: event.payload!.body,
                    header: event.payload!.header,
                    type: (event.payload as any).type ?? 'info',
                    count: 1,
                    timestamp: event.payload!.timestamp ?? new Date()
                };
            } else {
                // Duplicate notification - increment count
                const notification = notifications[id];
                notification.count++;
                notification.timestamp = event.payload!.timestamp ?? new Date();
                notifications[id] = notification;
            }
            return {...notifications};
        });
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
        this.feature.updateIcon('mdiBell');
    }

    public getNotificationCount(): number {
        return Object.keys(this._notifications()).length;
    }
}