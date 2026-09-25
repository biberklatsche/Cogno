import { Injector, Type } from "@angular/core";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import {
  SideMenuItem,
  SideMenuService,
} from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { SideMenuFeatureDefinition } from "@cogno/core/workbench/side-menu/+state/side-menu-feature-definitions";
import {
  SideMenuFeatureHandleContract,
  SideMenuFeatureLifecycleContract,
} from "@cogno/shared/contributions";
import { ApplicationConfigurationPort } from "@cogno/shared/ports";
import { Icon } from "@cogno/shared/ui";
import { Subscription } from "rxjs";

/**
 * One side-menu entry for as long as its feature is on. The feature-host builds
 * it when the feature activates and disposes it when the feature deactivates -
 * one runtime per activation, so nothing (menu item, keybinding, view listeners,
 * the config-order subscription) outlives the feature being off (ARCHITECTURE.md
 * 6.1). It owns the menu item, its lazily loaded panel, the open keybinding, the
 * view lifecycle hooks and the live `feature.<id>.order` override.
 */
export class SideMenuFeatureRuntime implements SideMenuFeatureHandleContract<Icon> {
  private menuItem: SideMenuItem;
  private readonly lifecycle: SideMenuFeatureLifecycleContract;
  private keybindSubscription?: Subscription;
  private readonly subscriptions = new Subscription();
  private disposed = false;

  constructor(
    private readonly config: SideMenuFeatureDefinition,
    injector: Injector,
    private readonly sideMenuService: SideMenuService,
    private readonly bus: AppBus,
    private readonly keybinds: KeybindService,
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
  ) {
    const isLazy =
      typeof config.targetComponent === "function" && !config.targetComponent.prototype;
    this.menuItem = {
      id: config.id,
      label: config.title,
      hidden: false,
      pinned: config.pinned ?? false,
      icon: config.icon,
      order: config.order,
      component: isLazy ? null : (config.targetComponent as Type<unknown>),
      actionName: config.actionName,
    };

    if (isLazy) {
      void (config.targetComponent as () => Promise<Type<unknown>>)().then((component) => {
        this.menuItem = { ...this.menuItem, component };
        sideMenuService.resolveComponent(config.title, component);
      });
    }

    this.lifecycle = config.createLifecycle?.(injector, this) ?? {};
    this.setupSideMenuListeners();
    this.setupOrderListener();
  }

  /** Show the entry, honour the keybinding, tell the lifecycle the feature is on. */
  activate(): void {
    this.lifecycle.onModeChange?.("on");
    this.menuItem = { ...this.menuItem, order: this.resolveOrder() };
    this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: false });
    this.addKeybindHandler();
  }

  /** Tear the entry down completely: lifecycle off, keybinding, item, subscriptions. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.lifecycle.onModeChange?.("off");
    this.removeKeybindHandler();
    this.sideMenuService.removeMenuItem(this.menuItem.label);
    this.subscriptions.unsubscribe();
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

  updateBadgeColor(color?: string): void {
    this.sideMenuService.updateBadgeColor(this.config.title, color);
  }

  private setupSideMenuListeners(): void {
    this.subscriptions.add(
      this.bus.on$("SideMenuViewOpened").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onOpen?.();
      }),
    );
    this.subscriptions.add(
      this.bus.on$("SideMenuViewClosed").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onClose?.();
      }),
    );
    this.subscriptions.add(
      this.bus.on$("SideMenuViewFocused").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onFocus?.();
      }),
    );
    this.subscriptions.add(
      this.bus.on$("SideMenuViewBlurred").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onBlur?.();
      }),
    );
  }

  /** Live order override: follow `feature.<id>.order` while the entry is shown. */
  private setupOrderListener(): void {
    this.subscriptions.add(
      this.applicationConfigurationPort.configuration$.subscribe(() => {
        const order = this.resolveOrder();
        if (order === this.menuItem.order) return;
        this.menuItem = { ...this.menuItem, order };
        this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: false });
      }),
    );
  }

  private resolveOrder(): number {
    const configuration = this.applicationConfigurationPort.getConfiguration() as Record<
      string,
      unknown
    >;
    const featureConfiguration = this.config.configPath
      .split(".")
      .reduce<unknown>((value, segment) => {
        if (typeof value !== "object" || value === null) return undefined;
        return (value as Record<string, unknown>)[segment];
      }, configuration);
    if (typeof featureConfiguration !== "object" || featureConfiguration === null) {
      return this.config.order;
    }
    const orderValue = (featureConfiguration as { order?: unknown }).order;
    return typeof orderValue === "number" ? orderValue : this.config.order;
  }

  private addKeybindHandler(): void {
    if (this.keybindSubscription) return;
    this.keybindSubscription = this.bus.on$("ActionFired").subscribe((event) => {
      if (event.payload === this.config.actionName) {
        this.sideMenuService.open(this.config.title);
        (event as { performed?: boolean }).performed = true;
      }
    });
  }

  private removeKeybindHandler(): void {
    this.keybindSubscription?.unsubscribe();
    this.keybindSubscription = undefined;
  }
}
