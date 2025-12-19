import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ConfigService} from "../../../config/+state/config.service";
import {computed, DestroyRef, effect} from "@angular/core";
import {Subscription} from "rxjs";
import {SideMenuItem, SideMenuService} from "./side-menu.service";
import {AppBus} from "../../../app-bus/app-bus";
import {ConfigTypes, FeatureMode} from "../../../config/+models/config.types";
import {Icon} from "../../../icons/+model/icon";

export abstract class SideMenuItemService {

    private _keybindSubscription?: Subscription;
    private _isOpened = false;

    constructor(
        protected readonly sideMenuService: SideMenuService,
        protected readonly bus: AppBus,
        readonly config: ConfigService,
        readonly ref: DestroyRef,
        protected readonly menuItem: SideMenuItem,
        protected readonly configSelector: (config: ConfigTypes) => FeatureMode
    ) {
        config.config$.pipe(takeUntilDestroyed(ref)).subscribe((config) => {
            switch (configSelector(config)) {
                case 'off': this.onConfigChanged('off'); this.removeKeybindHandler(); this.removeMenuItem(); break;
                case 'hidden': this.onConfigChanged('hidden'); this.addMenuItem(true); this.addKeybindHandler(); break;
                case 'visible': {
                    this.onConfigChanged('visible');
                    this.addMenuItem(false);
                    this.addKeybindHandler()
                    break;
                }
            }
        });
        effect(() => {
            const selectedItem = sideMenuService.selectedItem();
            const newIsOpened = selectedItem?.label === menuItem.label;
            if(newIsOpened != this._isOpened) {
                this.onViewChanged(newIsOpened);
            }
            this._isOpened = newIsOpened;
        })
    }

    private addMenuItem(hidden: boolean) {
        this.sideMenuService.addMenuItem({...this.menuItem, hidden: hidden});
    }

    private addKeybindHandler() {
        this._keybindSubscription?.unsubscribe();
        this._keybindSubscription = new Subscription();
        this._keybindSubscription.add(this.bus.on$({type: 'ActionFired', path: ['app', 'action']}).subscribe(event => {
            switch (event.payload) {
                case this.menuItem.actionName: {
                    this.sideMenuService.toggle(this.menuItem.label);
                    event.performed = true;
                    break;
                }
            }
        }));
    }

    private removeMenuItem() {
        this.sideMenuService.removeMenuItem(this.menuItem.label);
    }

    private removeKeybindHandler() {
        this._keybindSubscription?.unsubscribe();
    }

    protected updateIcon(icon: Icon) {
        this.sideMenuService.addMenuItem({...this.menuItem, icon: icon});
    }

    protected abstract onConfigChanged(featureMode: FeatureMode): void;
    protected abstract onViewChanged(visible: boolean): void;
}
