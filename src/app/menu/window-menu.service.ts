import { Injectable } from '@angular/core';
import {OS} from "../_tauri/os";
import {Submenu} from "@tauri-apps/api/menu/submenu";
import {MenuItem} from "@tauri-apps/api/menu/menuItem";
import {Menu} from "@tauri-apps/api/menu/menu";
import {ConfigService} from "../config/+state/config.service";
import {PhysicalPosition} from "@tauri-apps/api/dpi";
import {PredefinedMenuItem} from "@tauri-apps/api/menu/predefinedMenuItem";

@Injectable({
  providedIn: 'root'
})
export class WindowMenuService {

  private _menu: Menu | undefined;

  constructor() {
      switch (OS.platform()) {
          case 'windows':
          case "linux":
              break;
          case 'macos':
              this.createMacOsMenu('Shift+Command+Control+Alt+A').then();
      }

      setTimeout(async () => {
          const cogno = await this._menu!.get('cogno') as Submenu;
          const about = await cogno.get('about') as MenuItem;
          await about.setAccelerator('Ctrl+Alt+A');
          await this._menu?.setAsAppMenu();
      }, 5000);
  }

  private async createMacOsMenu(accelerator: string) {

      const aboutSubmenu = await Submenu.new({
          id: 'cogno',
          text: 'Cogno',
          items: [
              await MenuItem.new({
                  id: 'about',
                  text: 'About',
                  accelerator: accelerator,
                  action: () => {
                      console.log('About pressed');
                  },
              }),
              await PredefinedMenuItem.new({
                  item: 'Separator',
              }),
              await MenuItem.new({
                  id: 'quit',
                  text: 'Quit',
                  accelerator: 'Shift+Command+Control+Alt+A',
                  action: () => {
                      console.log('Quit pressed');
                  },
              }),
          ],
      });

      const fileSubmenu = await Submenu.new({
          text: 'File',
          items: [
              await MenuItem.new({
                  id: 'copy',
                  text: 'Copy',
                  accelerator: 'Shift+Command+Control+Alt+A',
                  action: () => {
                      console.log('Quit pressed');
                  },
              }),
          ],
      });

      this._menu = await Menu.new({
          items: [aboutSubmenu, fileSubmenu],
      });

      await this._menu.setAsAppMenu();
  }
}
