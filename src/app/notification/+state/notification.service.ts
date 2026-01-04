import {DestroyRef, computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {FeatureMode} from "../../config/+models/config.types";
import {NotificationSideComponent} from "../notification-side/notification-side.component";
import {Hash} from '../../common/hash/hash';
import {KeybindService} from "../../keybinding/keybind.service";
import {SideMenuRegistrationTool} from "../../menu/side-menu/+state/side-menu-registration.tool";

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


    private _subscription = new Subscription();

    private _notifications: WritableSignal<Record<NotificationId, Notification>> = signal({});

    readonly notifications: Signal<Notification[]> = computed(() => {
        return Object.values(this._notifications());
    });

    private updateIconFn: ((icon: any) => void) | undefined;

    constructor(
        private sideMenuService: SideMenuService,
        private bus: AppBus,
        private keybinds: KeybindService,
        private menuTool: SideMenuRegistrationTool,
        destroyRef: DestroyRef,
    ) {
        const helper = this.menuTool.setup({
            menuItem: {
                label: 'Notification',
                hidden: false,
                pinned: false,
                icon: 'mdiBell',
                component: NotificationSideComponent,
                actionName: 'open_notification'
            },
            configSelector: (config) => config.notification?.mode,
            onOpen: () => this.onOpen(),
            onClose: () => this.onClose(),
            onConfigChange: (mode) => this.onConfigChange(mode)
        }, destroyRef);
        this.updateIconFn = helper.updateIcon;
        this._subscription.add(this.bus.on$({type: 'Notification', path: ['notification']}).subscribe(event => {
            if (!event.payload) return;
            const id = Hash.create(event.payload.header + event.payload.body);
            this.updateIconFn?.('mdiBellBadge');
            this._notifications.update(notifications => {
                if (!notifications[id]) {
                    notifications[id] = {
                        id: id,
                        body: event.payload!.body,
                        header: event.payload!.header,
                        type: (event.payload as any).type ?? 'info',
                        count: 1,
                        timestamp: event.payload!.timestamp ?? new Date()
                    };
                } else {
                    const notification = notifications[id];
                    notification.count++;
                    notification.timestamp = event.payload!.timestamp ?? new Date();
                    notifications[id] = notification;

                }
                return {...notifications};
            });

        }));
    }

    protected onConfigChange(featureMode: FeatureMode): void {
        if (featureMode === 'off') {
            this._subscription.unsubscribe();
        }
    }
    protected onOpen(): void {
        this.updateIconFn?.('mdiBell');
        this.keybinds.registerListener(
            'inspector',
            ['Escape'],
            evt => this.sideMenuService.close()
        );
    }

    protected onClose(): void {
        this._subscription.unsubscribe();
        this.keybinds.unregisterListener('inspector');
    }

    remove(notificationId: NotificationId) {
        this._notifications.update(notifications => {
            delete notifications[notificationId];
            return {...notifications};
        });
    }
}
