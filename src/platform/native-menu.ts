import { Injectable } from "@angular/core";
import { Menu } from "@tauri-apps/api/menu/menu";
import { MenuItem } from "@tauri-apps/api/menu/menuItem";
import { PredefinedMenuItem } from "@tauri-apps/api/menu/predefinedMenuItem";
import { Submenu } from "@tauri-apps/api/menu/submenu";

@Injectable({ providedIn: "root" })
export class TauriMenu {
  new(options: Parameters<typeof Menu.new>[0]) {
    return Menu.new(options);
  }

  newItem(options: Parameters<typeof MenuItem.new>[0]) {
    return MenuItem.new(options);
  }

  newPredefinedItem(options: Parameters<typeof PredefinedMenuItem.new>[0]) {
    return PredefinedMenuItem.new(options);
  }

  newSubmenu(options: Parameters<typeof Submenu.new>[0]) {
    return Submenu.new(options);
  }
}

export type TauriMenuItemHandle = Awaited<ReturnType<typeof MenuItem.new>>;
