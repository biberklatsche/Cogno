import { DestroyRef, Injectable } from '@angular/core';
import { OS } from "@cogno/app-tauri/os";
import { TauriMenu, TauriMenuItemHandle } from "@cogno/app-tauri/native-menu";
import { ConfigService } from "../../config/+state/config.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { KeybindService } from "../../keybinding/keybind.service";
import { AppBus } from "../../app-bus/app-bus";
import { AppWindow } from "@cogno/app-tauri/window";
import { ActionFired, ActionName } from "../../action/action.models";
import { Config, FeatureMode } from "../../config/+models/config";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";

@Injectable({
  providedIn: 'root'
})
export class NativeMenuService {
  private latestConfig?: Config;

  constructor(
    private bus: AppBus,
    private keybindService: KeybindService,
    private readonly wiringService: AppWiringService,
    configService: ConfigService,
    ref: DestroyRef,
  ) {
    if (OS.platform() === 'macos') {
      configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(async (config) => {
        this.latestConfig = config;
        await this.buildMenu();
      });
      AppWindow.onFocusChanged$.subscribe(async (focus) => {
        if (focus) {
          await this.buildMenu();
        }
      });
    }
  }

  private async buildMenu() {
    const appSubmenu = await TauriMenu.newSubmenu({
      id: 'cogno',
      text: 'Cogno',
      items: [
        await this.buildMenuItem('open_config', 'Settings...'),
        await this.buildMenuItem('load_config', 'Reload Config'),
        await TauriMenu.newPredefinedItem({ item: 'Separator' }),
        await this.buildMenuItem('quit', 'Quit'),
      ],
    });

    const fileSubmenu = await TauriMenu.newSubmenu({
      text: 'File',
      items: [
        await this.buildMenuItem('new_window', 'New Window'),
        await this.buildMenuItem('new_tab', 'New Tab'),
        await TauriMenu.newPredefinedItem({ item: 'Separator' }),
        await this.buildMenuItem('split_right', 'Split Right'),
        await this.buildMenuItem('split_left', 'Split Left'),
        await this.buildMenuItem('split_down', 'Split Down'),
        await this.buildMenuItem('split_up', 'Split Up'),
        await TauriMenu.newPredefinedItem({ item: 'Separator' }),
        await this.buildMenuItem('close_tab', 'Close Tab'),
        await this.buildMenuItem('close_other_tabs', 'Close Other Tabs'),
        await this.buildMenuItem('close_all_tabs', 'Close All Tabs'),
      ],
    });

    const sideMenuFeatureDefinitions = this.wiringService.getSideMenuFeatureDefinitions();
    const sortedSideMenuFeatureDefinitions = [...sideMenuFeatureDefinitions].sort(
      (firstFeatureDefinition, secondFeatureDefinition) => firstFeatureDefinition.order - secondFeatureDefinition.order,
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

    const viewSubmenu = await TauriMenu.newSubmenu({
      text: 'View',
      items: viewMenuItems,
    });

    const menu = await TauriMenu.new({ items: [appSubmenu, fileSubmenu, viewSubmenu] });
    await menu.setAsAppMenu();
  }

  private async buildMenuItem(actionName: ActionName, text: string, enabled: boolean = true): Promise<TauriMenuItemHandle> {
    return await TauriMenu.newItem({
      id: actionName,
      text,
      enabled,
      accelerator: this.keybindService.getKeybinding(actionName),
      action: () => {
        const actionDef = this.keybindService.getActionDefinition(actionName);
        if (!actionDef) throw new Error(`Action definition ${actionName} not found.`);
        this.bus.publish(ActionFired.createFromDefinition(actionDef));
      },
    });
  }

  private isFeatureEnabled(mode: FeatureMode | undefined): boolean {
    return mode !== 'off';
  }

  private getFeatureMode(configPath: string): FeatureMode | undefined {
    const featureConfigValue = (this.latestConfig as unknown as Record<string, unknown> | undefined)?.[configPath];
    if (typeof featureConfigValue !== 'object' || featureConfigValue === null) {
      return undefined;
    }
    const modeValue = (featureConfigValue as { mode?: unknown }).mode;
    if (modeValue === 'off' || modeValue === 'hidden' || modeValue === 'visible') {
      return modeValue;
    }
    return undefined;
  }
}
