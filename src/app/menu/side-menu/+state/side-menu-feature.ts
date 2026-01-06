import { DestroyRef} from '@angular/core';
import { Subscription } from 'rxjs';
import {FeatureMode} from "../../../config/+models/config.types";
import {SideMenuItem, SideMenuService} from "./side-menu.service";
import {AppBus} from "../../../app-bus/app-bus";
import {ConfigService} from "../../../config/+state/config.service";
import {KeybindService} from "../../../keybinding/keybind.service";
import {Icon} from "../../../icons/+model/icon";
import {ActionName} from "../../../action/action.models";

/**
 * Configuration for a side menu feature
 */
export interface SideMenuFeatureConfig {
    /** Unique label for the feature */
    label: string;
    /** Icon identifier */
    icon: Icon;
    /** Action name for keybinding */
    actionName: ActionName;
    /** Component to render in side menu */
    component: any;
    /** Path in config object, e.g., 'workspace', 'inspector' */
    configPath: string;
    /** Whether the feature should be pinned by default */
    pinned?: boolean;
}

/**
 * Lifecycle hooks for side menu features
 */
export interface SideMenuFeatureLifecycle {
    /** Called when feature mode changes */
    onModeChange?(mode: FeatureMode): void;
    /** Called when side menu is opened */
    onOpen?(): void;
    /** Called when side menu is closed */
    onClose?(): void;
}

/**
 * Manages the integration of a feature with the side menu system.
 * Handles configuration, keybindings, and lifecycle automatically.
 */
export class SideMenuFeature {
    private readonly menuItem: SideMenuItem;
    private keybindSubscription?: Subscription;
    private readonly subscriptions = new Subscription();

    constructor(
        private readonly config: SideMenuFeatureConfig,
        private readonly lifecycle: SideMenuFeatureLifecycle,
        private readonly sideMenuService: SideMenuService,
        private readonly bus: AppBus,
        private readonly configService: ConfigService,
        private readonly keybinds: KeybindService,
        destroyRef: DestroyRef
    ) {
        this.menuItem = {
            label: config.label,
            hidden: false,
            pinned: config.pinned ?? false,
            icon: config.icon,
            component: config.component,
            actionName: config.actionName,
        };

        this.setupConfigListener();
        this.setupSideMenuListeners();

        destroyRef.onDestroy(() => this.destroy());
    }

    private setupConfigListener(): void {
        const sub = this.configService.config$.subscribe((cfg) => {
            const mode = this.getFeatureMode(cfg);
            this.handleModeChange(mode);
        });
        this.subscriptions.add(sub);
    }

    private setupSideMenuListeners(): void {
        const openSub = this.bus.onType$('SideMenuViewOpened').subscribe((event) => {
            if (event.payload?.label === this.config.label) {
                this.lifecycle.onOpen?.();
            }
        });

        const closeSub = this.bus.onType$('SideMenuViewClosed').subscribe((event) => {
            if (event.payload?.label === this.config.label) {
                this.lifecycle.onClose?.();
            }
        });

        this.subscriptions.add(openSub);
        this.subscriptions.add(closeSub);
    }

    private getFeatureMode(cfg: any): FeatureMode {
        const featureConfig = cfg[this.config.configPath];
        return featureConfig?.mode ?? 'visible';
    }

    private handleModeChange(mode: FeatureMode): void {
        this.lifecycle.onModeChange?.(mode);

        switch (mode) {
            case 'off':
                this.removeKeybindHandler();
                this.sideMenuService.removeMenuItem(this.menuItem.label);
                break;
            case 'hidden':
                this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: true });
                this.addKeybindHandler();
                break;
            case 'visible':
                this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: false });
                this.addKeybindHandler();
                break;
        }
    }

    private addKeybindHandler(): void {
        if (this.keybindSubscription) return;

        this.keybindSubscription = this.bus
            .on$({ type: 'ActionFired', path: ['app', 'action'] })
            .subscribe((event) => {
                if (event.payload === this.config.actionName) {
                    this.sideMenuService.open(this.config.label);
                    (event as any).performed = true;
                }
            });
    }

    private removeKeybindHandler(): void {
        this.keybindSubscription?.unsubscribe();
        this.keybindSubscription = undefined;
    }

    private destroy(): void {
        this.subscriptions.unsubscribe();
        this.removeKeybindHandler();
    }

    /**
     * Helper to register keyboard listener for the feature
     */
    registerKeybindListener(keys: string[], handler: (evt: KeyboardEvent) => void): void {
        this.keybinds.registerListener(this.config.configPath, keys, handler);
    }

    /**
     * Helper to unregister keyboard listener for the feature
     */
    unregisterKeybindListener(): void {
        this.keybinds.unregisterListener(this.config.configPath);
    }

    /**
     * Helper to close the side menu
     */
    close(): void {
        this.sideMenuService.close();
    }

    /**
     * Helper to update the menu icon
     */
    updateIcon(icon: Icon): void {
        this.sideMenuService.updateIcon(this.config.label, icon);
    }
}

/**
 * Factory function to create a SideMenuFeature instance
 */
export function createSideMenuFeature(
    config: SideMenuFeatureConfig,
    lifecycle: SideMenuFeatureLifecycle,
    deps: {
        sideMenuService: SideMenuService;
        bus: AppBus;
        configService: ConfigService;
        keybinds: KeybindService;
        destroyRef: DestroyRef;
    }
): SideMenuFeature {
    return new SideMenuFeature(
        config,
        lifecycle,
        deps.sideMenuService,
        deps.bus,
        deps.configService,
        deps.keybinds,
        deps.destroyRef
    );
}
