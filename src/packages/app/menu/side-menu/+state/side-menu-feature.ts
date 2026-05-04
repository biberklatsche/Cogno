import { DestroyRef } from "@angular/core";
import {
  FeatureModeContract,
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/core-api";
import { Icon } from "@cogno/core-ui";
import { Subscription } from "rxjs";
import { AppBus } from "../../../app-bus/app-bus";
import { ConfigService } from "../../../config/+state/config.service";
import { KeybindService } from "../../../keybinding/keybind.service";
import { SideMenuItem, SideMenuService } from "./side-menu.service";
import { SideMenuFeatureDefinition } from "./side-menu-feature-definitions";

/**
 * Manages the integration of a feature with the side menu system.
 * Handles configuration, keybindings, and lifecycle automatically.
 */
export class SideMenuFeature implements SideMenuFeatureHandleContract<Icon> {
  private readonly menuItem: SideMenuItem;
  private keybindSubscription?: Subscription;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly config: SideMenuFeatureDefinition,
    private readonly lifecycle: SideMenuFeatureLifecycleContract,
    private readonly sideMenuService: SideMenuService,
    private readonly bus: AppBus,
    private readonly configService: ConfigService,
    private readonly keybinds: KeybindService,
    destroyRef: DestroyRef,
  ) {
    this.menuItem = {
      id: config.id,
      label: config.title,
      hidden: false,
      pinned: config.pinned ?? false,
      icon: config.icon,
      order: config.order,
      component: config.targetComponent,
      actionName: config.actionName,
    };

    this.setupConfigListener();
    this.setupSideMenuListeners();

    destroyRef.onDestroy(() => this.destroy());
  }

  private setupConfigListener(): void {
    const sub = this.configService.config$.subscribe((cfg) => {
      const mode = this.getFeatureMode(cfg as Record<string, unknown>);
      const isAvailable = this.config.isAvailable?.(cfg as Record<string, unknown>) ?? true;
      this.handleModeChange(mode, isAvailable);
    });
    this.subscriptions.add(sub);
  }

  private setupSideMenuListeners(): void {
    const openSub = this.bus.onType$("SideMenuViewOpened").subscribe((event) => {
      if (event.payload?.label === this.config.title) {
        this.lifecycle.onOpen?.();
      }
    });

    const closeSub = this.bus.onType$("SideMenuViewClosed").subscribe((event) => {
      if (event.payload?.label === this.config.title) {
        this.lifecycle.onClose?.();
      }
    });

    const focusSub = this.bus.onType$("SideMenuViewFocused").subscribe((event) => {
      if (event.payload?.label === this.config.title) {
        this.lifecycle.onFocus?.();
      }
    });

    const blurSub = this.bus.onType$("SideMenuViewBlurred").subscribe((event) => {
      if (event.payload?.label === this.config.title) {
        this.lifecycle.onBlur?.();
      }
    });

    this.subscriptions.add(openSub);
    this.subscriptions.add(closeSub);
    this.subscriptions.add(focusSub);
    this.subscriptions.add(blurSub);
  }

  private getFeatureMode(configuration: Record<string, unknown>): FeatureModeContract {
    const featureConfiguration = configuration[this.config.configPath];
    if (typeof featureConfiguration !== "object" || featureConfiguration === null) {
      return "visible";
    }

    const modeValue = (featureConfiguration as { mode?: unknown }).mode;
    if (modeValue === "off" || modeValue === "hidden" || modeValue === "visible") {
      return modeValue;
    }

    return "visible";
  }

  private handleModeChange(mode: FeatureModeContract, isAvailable: boolean): void {
    this.lifecycle.onModeChange?.(mode);

    if (!isAvailable) {
      this.removeKeybindHandler();
      if (this.sideMenuService.isSelected(this.menuItem.label)) {
        this.sideMenuService.close(true);
      }
      this.sideMenuService.removeMenuItem(this.menuItem.label);
      return;
    }

    switch (mode) {
      case "off":
        this.removeKeybindHandler();
        this.sideMenuService.removeMenuItem(this.menuItem.label);
        break;
      case "hidden":
        this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: true });
        this.addKeybindHandler();
        break;
      case "visible":
        this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: false });
        this.addKeybindHandler();
        break;
    }
  }

  private addKeybindHandler(): void {
    if (this.keybindSubscription) return;

    this.keybindSubscription = this.bus
      .on$({ type: "ActionFired", path: ["app", "action"] })
      .subscribe((event) => {
        if (event.payload === this.config.actionName) {
          this.sideMenuService.open(this.config.title);
          const mutableEvent = event as { performed?: boolean };
          mutableEvent.performed = true;
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

  registerKeybindListener(keys: string[], handler: (evt: KeyboardEvent) => void): void {
    this.keybinds.registerListener(this.config.configPath, keys, handler);
  }

  unregisterKeybindListener(): void {
    this.keybinds.unregisterListener(this.config.configPath);
  }

  close(): void {
    this.sideMenuService.close();
  }

  updateIcon(icon: Icon): void {
    this.sideMenuService.updateIcon(this.config.title, icon);
  }
}

export function createSideMenuFeature(
  config: SideMenuFeatureDefinition,
  lifecycle: SideMenuFeatureLifecycleContract,
  deps: {
    sideMenuService: SideMenuService;
    bus: AppBus;
    configService: ConfigService;
    keybinds: KeybindService;
    destroyRef: DestroyRef;
  },
): SideMenuFeature {
  return new SideMenuFeature(
    config,
    lifecycle,
    deps.sideMenuService,
    deps.bus,
    deps.configService,
    deps.keybinds,
    deps.destroyRef,
  );
}
