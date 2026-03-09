import {DestroyRef, Injectable} from '@angular/core';
import {OS} from "../../_tauri/os";
import {Submenu} from "@tauri-apps/api/menu/submenu";
import {MenuItem} from "@tauri-apps/api/menu/menuItem";
import {Menu} from "@tauri-apps/api/menu/menu";
import {ConfigService} from "../../config/+state/config.service";
import {PredefinedMenuItem} from "@tauri-apps/api/menu/predefinedMenuItem";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {KeybindService} from "../../keybinding/keybind.service";
import {AppBus} from "../../app-bus/app-bus";
import {AppWindow} from "../../_tauri/window";
import {ActionFired, ActionName} from "../../action/action.models";
import {Config, FeatureMode} from "../../config/+models/config";
import {CoreHostWiringService} from "../../core-host/core-host-wiring.service";

@Injectable({
  providedIn: 'root'
})
export class NativeMenuService {
  private latestConfig?: Config;


  constructor(
    private bus: AppBus,
    private keybindService: KeybindService,
    private readonly coreHostWiringService: CoreHostWiringService,
    configService: ConfigService,
    ref: DestroyRef,
  ) {
      if(OS.platform() === 'macos') {
          configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(async (config) => {
              this.latestConfig = config;
              await this.buildMenu();
          });
          AppWindow.onFocusChanged$.subscribe(async (focus) => {
              if(focus) {
                  await this.buildMenu();
              }
          });
      }

  }

  private async buildMenu() {
      const aboutSubmenu = await Submenu.new({
          id: 'cogno',
          text: 'Cogno',
          items: [
              await MenuItem.new({
                  id: 'about',
                  text: 'About',
                  action: () => {
                      console.log('TODO: About pressed');
                  },
              }),
              await PredefinedMenuItem.new({
                  item: 'Separator',
              }),
              await this.buildMenuItem('open_config', 'Settings...'),
              await this.buildMenuItem('load_config', 'Reload Config'),
              await PredefinedMenuItem.new({
                  item: 'Separator',
              }),
              await this.buildMenuItem('quit', 'Quit'),
          ],
      });

      const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
              await this.buildMenuItem('new_window', 'New Window'),
              await this.buildMenuItem('new_tab', 'New Tab'),
              await PredefinedMenuItem.new({
                  item: 'Separator',
              }),
              await this.buildMenuItem('split_right', 'Split Right'),
              await this.buildMenuItem('split_left', 'Split Left'),
              await this.buildMenuItem('split_down', 'Split Down'),
              await this.buildMenuItem('split_up', 'Split Up'),
              await PredefinedMenuItem.new({
                  item: 'Separator',
              }),
              await this.buildMenuItem('close_tab', 'Close Tab'),
              await this.buildMenuItem('close_other_tabs', 'Close Other Tabs'),
              await this.buildMenuItem('close_all_tabs', 'Close All Tabs'),
          ],
      });

      const sideMenuFeatureDefinitions = this.coreHostWiringService
        .getSideMenuFeatureDefinitions();
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

      const viewSubmenu = await Submenu.new({
          text: 'View',
          items: viewMenuItems,
      });

      const menu = await Menu.new({
          items: [aboutSubmenu, fileSubmenu, viewSubmenu],
      });

      await menu.setAsAppMenu();
  }

  private async buildMenuItem(actionName: ActionName, text: string, enabled: boolean = true): Promise<MenuItem> {
      return await MenuItem.new({
          id: actionName,
          text: text,
          enabled: enabled,
          accelerator: this.keybindService.getKeybinding(actionName),
          action: () => {
              const actionDef = this.keybindService.getActionDefinition(actionName);
              if(!actionDef) throw new Error(`Action definition ${actionName} not found.`);
              this.bus.publish(ActionFired.createFromDefinition(actionDef));
          },
      })
  }

  private isFeatureEnabled(mode: FeatureMode | undefined): boolean {
      return mode !== 'off';
  }

  private getFeatureMode(configPath: string): FeatureMode | undefined {
      const featureConfigValue = (this.latestConfig as unknown as Record<string, unknown> | undefined)?.[configPath];
      if (typeof featureConfigValue !== "object" || featureConfigValue === null) {
          return undefined;
      }
      const modeValue = (featureConfigValue as { mode?: unknown }).mode;
      if (modeValue === "off" || modeValue === "hidden" || modeValue === "visible") {
          return modeValue;
      }
      return undefined;
  }
}
