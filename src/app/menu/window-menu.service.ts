import { Injectable } from '@angular/core';
import {OS} from "../_tauri/os";
import {Submenu} from "@tauri-apps/api/menu/submenu";
import {MenuItem} from "@tauri-apps/api/menu/menuItem";
import {Menu} from "@tauri-apps/api/menu/menu";

@Injectable({
  providedIn: 'root'
})
export class WindowMenuService {
  constructor() {
      switch (OS.platform()) {
          case 'windows':
          case "linux":
              break;
          case 'macos':
              this.createMacOsMenu().then();
      }
  }

  private async createMacOsMenu() {
      const aboutSubmenu = await Submenu.new({
          text: 'About',
          items: [
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

      const menu = await Menu.new({
          items: [aboutSubmenu],
      });

      await menu.setAsAppMenu();
  }
}
