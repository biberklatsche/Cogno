import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { Config, FeatureMode } from "@cogno/core/infrastructure/config/models/config";
import { ActionFired, ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { TauriMenu, TauriMenuItemHandle } from "@cogno/platform/native-menu";
import { OsPlatform } from "@cogno/platform/os";
import { AppWindow } from "@cogno/platform/window";
import { normalizeFeatureMode } from "@cogno/shared/domain";

@Injectable({
  providedIn: "root",
})
export class NativeMenuService {
  private latestConfig?: Config;

  constructor(
    private readonly tauriMenu: TauriMenu,
    private readonly appWindow: AppWindow,
    private readonly os: OsPlatform,
    private bus: AppBus,
    private keybindService: KeybindService,
    private readonly wiringService: AppWiringService,
    configService: ConfigService,
    ref: DestroyRef,
  ) {
    if (this.os.platform() === "macos") {
      configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(async (config) => {
        this.latestConfig = config;
        await this.buildMenu();
      });
      this.appWindow.onFocusChanged$.pipe(takeUntilDestroyed(ref)).subscribe(async (focus) => {
        if (focus) {
          await this.buildMenu();
        }
      });
    }
  }

  private async buildMenu() {
    const appSubmenu = await this.tauriMenu.newSubmenu({
      id: "cogno",
      text: "Cogno",
      items: [
        await this.buildMenuItem("open_about", "About Cogno"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("open_config", "Settings"),
        await this.buildMenuItem("load_config", "Reload Configuration"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("quit", "Quit"),
      ],
    });

    const fileSubmenu = await this.tauriMenu.newSubmenu({
      text: "File",
      items: [
        await this.buildMenuItem("new_window", "New Window"),
        await this.buildMenuItem("new_tab", "New Tab"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("split_right", "Split Right"),
        await this.buildMenuItem("split_left", "Split Left"),
        await this.buildMenuItem("split_down", "Split Down"),
        await this.buildMenuItem("split_up", "Split Up"),
        await this.tauriMenu.newPredefinedItem({ item: "Separator" }),
        await this.buildMenuItem("close_tab", "Close Tab"),
        await this.buildMenuItem("close_other_tabs", "Close Other Tabs"),
        await this.buildMenuItem("close_all_tabs", "Close All Tabs"),
      ],
    });

    const sideMenuFeatureDefinitions = this.wiringService.getSideMenuFeatureDefinitions();
    const sortedSideMenuFeatureDefinitions = [...sideMenuFeatureDefinitions].sort(
      (firstFeatureDefinition, secondFeatureDefinition) =>
        firstFeatureDefinition.order - secondFeatureDefinition.order,
    );

    const viewMenuItems = await Promise.all(
      sortedSideMenuFeatureDefinitions.map(async (sideMenuFeatureDefinition) => {
        const mode = this.getFeatureMode(sideMenuFeatureDefinition.configPath);
        return this.buildMenuItem(
          sideMenuFeatureDefinition.actionName,
          sideMenuFeatureDefinition.title,
          this.isFeatureEnabled(mode),
        );
      }),
    );

    const viewSubmenu = await this.tauriMenu.newSubmenu({
      text: "View",
      items: viewMenuItems,
    });

    const helpSubmenu = await this.tauriMenu.newSubmenu({
      text: "Help",
      items: [
        await this.tauriMenu.newItem({
          id: "open_documentation",
          text: "Documentation",
          enabled: true,
          action: () => {
            this.bus.publish(ActionFired.create("open_documentation"));
          },
        }),
      ],
    });

    const menu = await this.tauriMenu.new({
      items: [appSubmenu, fileSubmenu, viewSubmenu, helpSubmenu],
    });
    await menu.setAsAppMenu();
  }

  private async buildMenuItem(
    actionName: ActionName,
    text: string,
    enabled: boolean = true,
  ): Promise<TauriMenuItemHandle> {
    return await this.tauriMenu.newItem({
      id: actionName,
      text,
      enabled,
      accelerator: this.keybindService.getKeybinding(actionName),
      action: () => {
        const actionDef = this.keybindService.getActionDefinition(actionName);
        this.bus.publish(
          actionDef ? ActionFired.createFromDefinition(actionDef) : ActionFired.create(actionName),
        );
      },
    });
  }

  private isFeatureEnabled(mode: FeatureMode | undefined): boolean {
    return mode !== "off";
  }

  private getFeatureMode(configPath: string): FeatureMode | undefined {
    const featureConfigValue = (
      this.latestConfig as unknown as Record<string, unknown> | undefined
    )?.[configPath];
    if (typeof featureConfigValue !== "object" || featureConfigValue === null) {
      return undefined;
    }
    return normalizeFeatureMode((featureConfigValue as { mode?: unknown }).mode);
  }
}
