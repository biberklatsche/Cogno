import { DestroyRef, Injectable, effect, Injector, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SideMenuItem, SideMenuService } from './side-menu.service';
import { AppBus } from '../../../app-bus/app-bus';
import { ConfigService } from '../../../config/+state/config.service';
import { ConfigTypes, FeatureMode } from '../../../config/+models/config.types';
import { Icon } from '../../../icons/+model/icon';

export type SideMenuRegistrationParams = {
    menuItem: SideMenuItem;
    configSelector: (config: ConfigTypes) => FeatureMode;
    onOpen: () => void;
    onClose: () => void;
    onConfigChange?: (mode: FeatureMode) => void;
};

@Injectable({ providedIn: 'root' })
export class SideMenuRegistrationTool {
    // We inject the global injector if we need it for effects
    private readonly injector = inject(Injector);

    constructor(
        private readonly sideMenuService: SideMenuService,
        private readonly bus: AppBus,
        private readonly config: ConfigService,
    ) {}

    /**
     * Setup for SideMenu registration.
     * Must be called in the injection context (constructor).
     */
    setup(params: SideMenuRegistrationParams, destroyRef: DestroyRef) {
        let keybindSubscription: Subscription | undefined;
        let isOpened = false;

        const addMenuItem = (hidden: boolean) => {
            this.sideMenuService.addMenuItem({ ...params.menuItem, hidden });
        };

        const removeMenuItem = () => {
            this.sideMenuService.removeMenuItem(params.menuItem.label);
        };

        const addKeybindHandler = () => {
            if (keybindSubscription) return; // Avoid double registration
            keybindSubscription = this.bus
                .on$({ type: 'ActionFired', path: ['app', 'action'] })
                .subscribe((event) => {
                    if (event.payload === params.menuItem.actionName) {
                        this.sideMenuService.open(params.menuItem.label);
                        (event as any).performed = true;
                    }
                });
        };

        const removeKeybindHandler = () => {
            keybindSubscription?.unsubscribe();
            keybindSubscription = undefined;
        };

        // 1. Config Subscription
        const cfgSub = this.config.config$.subscribe((cfg) => {
            const mode = params.configSelector(cfg);
            switch (mode) {
                case 'off':
                    params.onConfigChange?.('off');
                    removeKeybindHandler();
                    removeMenuItem();
                    break;
                case 'hidden':
                    params.onConfigChange?.('hidden');
                    addMenuItem(true);
                    addKeybindHandler();
                    break;
                case 'visible':
                    params.onConfigChange?.('visible');
                    addMenuItem(false);
                    addKeybindHandler();
                    break;
            }
        });

        // 2. Effect for UI synchronization (Zoneless friendly)
        // We use the injector to ensure that the effect can be bound to the
        // lifecycle of the calling service.
        const sideMenuEffect = effect(
            () => {
                const selectedItem = this.sideMenuService.selectedItem();
                const newIsOpened = selectedItem?.label === params.menuItem.label;

                if (newIsOpened !== isOpened) {
                    if (newIsOpened) {
                        params.onOpen();
                    } else {
                        params.onClose();
                    }
                    isOpened = newIsOpened;
                }
            },
            { injector: this.injector } // Uses the context of the calling service
        );

        // 3. Cleanup
        destroyRef.onDestroy(() => {
            cfgSub.unsubscribe();
            removeKeybindHandler();
            // Effects in the injection context are automatically destroyed,
            // but we could still force manual cleanup here if necessary.
        });

        return {
            updateIcon: (icon: Icon) => {
                this.sideMenuService.addMenuItem({ ...params.menuItem, icon });
            }
        };
    }
}
