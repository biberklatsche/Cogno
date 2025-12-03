import {DestroyRef, Injectable} from '@angular/core';
import {Subscription} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {ConfigService} from "../../config/+state/config.service";
import {SideMenuService} from "../../menu/side-menu/+state/side-menu.service";
import {SideMenuItemService} from "../../menu/side-menu/+state/side-menu-item.service";
import {ConfigTypes} from "../../config/+models/config.types";
import {NotificationSideComponent} from "../notification-side/notification-side.component";


@Injectable({providedIn: 'root'})
export class NotificationService extends SideMenuItemService {

    private _subscription: Subscription | undefined;


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
    }

    initView() {
        this.onDispose();
        this._subscription = new Subscription();
        this._subscription.add(this.bus.on$({type: 'Notification', path: ['notification']}).subscribe(event => {

        }));
        setTimeout(() => {
            this.updateIcon('mdiBellBadge');
        }, 5000)
    }

    onDispose() {
        this._subscription?.unsubscribe();
        this._subscription = undefined;
    }
}
