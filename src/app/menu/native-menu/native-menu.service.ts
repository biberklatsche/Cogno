import {DestroyRef, Injectable} from '@angular/core';
import {OS} from "../../_tauri/os";
import {Submenu} from "@tauri-apps/api/menu/submenu";
import {MenuItem} from "@tauri-apps/api/menu/menuItem";
import {Menu} from "@tauri-apps/api/menu/menu";
import {ConfigService} from "../../config/+state/config.service";
import {PredefinedMenuItem} from "@tauri-apps/api/menu/predefinedMenuItem";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ActionName} from "../../config/+models/config.types";
import {KeybindService} from "../../keybinding/keybind.service";
import {AppBus} from "../../app-bus/app-bus";
import {AppWindow} from "../../_tauri/window";

@Injectable({
  providedIn: 'root'
})
export class NativeMenuService {


  constructor(private bus: AppBus, private keybindService: KeybindService, configService: ConfigService, ref: DestroyRef) {
      if(OS.platform() === 'macos') {
          configService.config$.pipe(takeUntilDestroyed(ref)).subscribe(async () => {
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
                  accelerator: this.keybindService.getKeybinding('copy'),
                  action: () => {
                      console.log('About pressed');
                  },
              }),
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
          ],
      });

      const menu = await Menu.new({
          items: [aboutSubmenu, fileSubmenu],
      });

      await menu.setAsAppMenu();
  }

  private async buildMenuItem(actionName: ActionName, text: string): Promise<MenuItem> {
      return await MenuItem.new({
          id: actionName,
          text: text,
          accelerator: this.keybindService.getKeybinding(actionName),
          action: () => {
              const actionDef = this.keybindService.getActionDefinition(actionName);
              if(!actionDef) throw new Error(`Action definition ${actionName} not found.`);
              this.bus.publish({
                  type: 'KeybindFired',
                  payload: actionDef.actionName,
                  trigger: actionDef.trigger,
                  args: actionDef.args,
                  path: ['app', 'keybind']
              });
          },
      })
  }
}
