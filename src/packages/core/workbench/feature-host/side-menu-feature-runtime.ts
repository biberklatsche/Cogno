import { DestroyRef, Injector, Type } from "@angular/core";
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
 * One side-menu entry as the feature-host drives it. The feature-host decides
 * whether it is on (activate/deactivate); this owns everything that entry needs
 * while it exists - the menu item, its lazily loaded panel, the open keybinding,
 * the view lifecycle hooks and the config-driven order override. What it no
 * longer does is read `mode`: that is the reconciler's job now (step 22b).
 */
export class SideMenuFeatureRuntime implements SideMenuFeatureHandleContract<Icon> {
  private menuItem: SideMenuItem;
  private readonly lifecycle: SideMenuFeatureLifecycleContract;
  private keybindSubscription?: Subscription;
  private readonly subscriptions = new Subscription();
  private active = false;

  constructor(
    private readonly config: SideMenuFeatureDefinition,
    injector: Injector,
    private readonly sideMenuService: SideMenuService,
    private readonly bus: AppBus,
    private readonly keybinds: KeybindService,
    private readonly applicationConfigurationPort: ApplicationConfigurationPort,
    destroyRef: DestroyRef,
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

    destroyRef.onDestroy(() => this.destroy());
  }

  /** The feature is on: show the entry, honour the keybinding, tell the lifecycle. */
  activate(): void {
    this.active = true;
    this.lifecycle.onModeChange?.("on");
    this.menuItem = { ...this.menuItem, order: this.resolveOrder() };
    this.sideMenuService.addMenuItem({ ...this.menuItem, hidden: false });
    this.addKeybindHandler();
  }

  /** The feature is off: tell the lifecycle, drop the keybinding and the entry. */
  deactivate(): void {
    this.active = false;
    this.lifecycle.onModeChange?.("off");
    this.removeKeybindHandler();
    this.sideMenuService.removeMenuItem(this.menuItem.label);
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

  private setupSideMenuListeners(): void {
    this.subscriptions.add(
      this.bus.onType$("SideMenuViewOpened").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onOpen?.();
      }),
    );
    this.subscriptions.add(
      this.bus.onType$("SideMenuViewClosed").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onClose?.();
      }),
    );
    this.subscriptions.add(
      this.bus.onType$("SideMenuViewFocused").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onFocus?.();
      }),
    );
    this.subscriptions.add(
      this.bus.onType$("SideMenuViewBlurred").subscribe((event) => {
        if (event.payload?.label === this.config.title) this.lifecycle.onBlur?.();
      }),
    );
  }

  /** Live order override: while the entry is shown, follow `feature.<id>.order`. */
  private setupOrderListener(): void {
    this.subscriptions.add(
      this.applicationConfigurationPort.configuration$.subscribe(() => {
        if (!this.active) return;
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
    this.keybindSubscription = this.bus
      .on$({ type: "ActionFired", path: ["app", "action"] })
      .subscribe((event) => {
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

  private destroy(): void {
    this.subscriptions.unsubscribe();
    this.removeKeybindHandler();
  }
}
