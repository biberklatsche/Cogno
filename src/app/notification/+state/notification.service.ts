import {computed, DestroyRef, Injectable, OnDestroy, Signal, signal, WritableSignal} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {SideMenuItemService} from "../../menu/side-menu/+state/side-menu-item.service";
import {ConfigTypes} from "../../config/+models/config.types";
import {NotificationSideComponent} from "../notification-side/notification-side.component";
import {Hash} from '../../common/hash/hash';

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
export class NotificationService extends SideMenuItemService {

    private _subscription = new Subscription();

    private _notifications: WritableSignal<Record<NotificationId, Notification>> = signal({});

    readonly notifications: Signal<Notification[]> = computed(() =>
        Object.values(this._notifications())
    );


    constructor(sideMenuService: SideMenuService, override bus: AppBus, config: ConfigService, ref: DestroyRef) {
        super(sideMenuService, bus, config, ref, {
                label: 'Notification',
                hidden: false,
                icon: 'mdiBell',
                component: NotificationSideComponent,
                actionName: 'toggle_notification'
            },
            (config: ConfigTypes) => config.notification?.mode
        );
    this._subscription.add(this.bus.on$({type: 'Notification', path: ['notification']}).subscribe(event => {
            if(!event.payload) return;
            const id = Hash.create(event.payload.header + event.payload.body);
            this._notifications.update(notifications =>  {
                if(!notifications[id]) {
                    notifications[id] = {
                        id: id,
                        body: event.payload!.body,
                        header: event.payload!.header,
                        type: (event.payload as any).type ?? 'info',
                        count: 3,
                        timestamp: event.payload!.timestamp ?? new Date()
                    };
                    return notifications;
                } else {
                    const notification = notifications[id];
                    notification.count++;
                    notification.timestamp = event.payload!.timestamp ?? new Date();
                    notifications[id] = notification;
                    return notifications;
                }
            });
            this.updateIcon('mdiBellBadge');
        }));
    }

    initView() {
        this.updateIcon('mdiBell');
    }

    onDisable() {
        this._subscription.unsubscribe();
    }

    remove(notificationId: NotificationId) {
        this._notifications.update(ns => {
            const notifications = {...this._notifications()};
            delete notifications[notificationId];
            return notifications;
        });
    }
}
