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

export type Notification = {
    id: NotificationId;
    header: string;
    body?: string;
    count: number;
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
                    notifications[id] = {id: id, body: event.payload!.body, header: event.payload!.header, count: 1}
                    return notifications;
                } else {
                    const notification = notifications[id];
                    notification.count++;
                    notifications[id] = notification;
                    return notifications;
                }
            });
            this.updateIcon('mdiBellBadge');
        }));
    }

    initView() {
    }

    onDisable() {
        this._subscription.unsubscribe();
    }
}
