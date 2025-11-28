import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ConfigService} from "../../../config/+state/config.service";
import {DestroyRef} from "@angular/core";
import {Subscription} from "rxjs";
import {SideMenuItem, SideMenuService} from "./side-menu.service";
import {AppBus} from "../../../app-bus/app-bus";

export abstract class SideMenuItemService {

    protected _keybindSubscription?: Subscription;

    constructor(
        protected sideMenuService: SideMenuService,
        protected bus: AppBus,
        config: ConfigService,
        ref: DestroyRef,
        protected menuItem: SideMenuItem
    ) {
        config.config$.pipe(takeUntilDestroyed(ref)).subscribe((config) => {
            switch (config.inspector?.mode) {
                case 'off': this.dispose(); this.removeKeybindHandler(); this.removeMenuItem(); break;
                case 'hidden': this.addMenuItem(true); this.addKeybindHandler(); break;
                case 'visible': {
                    this.addMenuItem(false);
                    this.addKeybindHandler()
                    break;
                }
            }
        });
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

    abstract dispose(): void;
}