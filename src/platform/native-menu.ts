import { Injectable } from "@angular/core";
import type { Resource } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu/menu";
import { MenuItem } from "@tauri-apps/api/menu/menuItem";
import { PredefinedMenuItem } from "@tauri-apps/api/menu/predefinedMenuItem";
import { Submenu } from "@tauri-apps/api/menu/submenu";
import { Logger } from "./logger";

@Injectable({ providedIn: "root" })
export class TauriMenu {
  /** Every native object made since the last release: nothing frees one on its own. */
  private made: Resource[] = [];

  new(options: Parameters<typeof Menu.new>[0]) {
    return this.keep(Menu.new(options));
  }

  newItem(options: Parameters<typeof MenuItem.new>[0]) {
    return this.keep(MenuItem.new(options));
  }

  newPredefinedItem(options: Parameters<typeof PredefinedMenuItem.new>[0]) {
    return this.keep(PredefinedMenuItem.new(options));
  }

  newSubmenu(options: Parameters<typeof Submenu.new>[0]) {
    return this.keep(Submenu.new(options));
  }

  /**
   * Makes `menu` the app menu and releases the handle Tauri returns for the
   * menu it replaces.
   */
  async setAsAppMenu(menu: Menu): Promise<void> {
    const replaced = await menu.setAsAppMenu();
    if (replaced) await this.close([replaced]);
  }

  /**
   * Releases every object made so far. A menu that is set stays on screen, but
   * its entries stop answering clicks - so call this right before building the
   * menu that replaces it, not after: Tauri keeps click handlers by entry id,
   * and releasing an old entry would take the new one's handler with it.
   */
  async releaseAll(): Promise<void> {
    const made = this.made;
    this.made = [];
    await this.close(made);
  }

  private async keep<T extends Resource>(resource: Promise<T>): Promise<T> {
    const kept = await resource;
    this.made.push(kept);
    return kept;
  }

  private async close(resources: Resource[]): Promise<void> {
    await Promise.all(
      resources.map((resource) =>
        resource
          .close()
          .catch((error) => Logger.warn(`Could not release a native menu object: ${error}`)),
      ),
    );
  }
}

export type TauriMenuItemHandle = Awaited<ReturnType<typeof MenuItem.new>>;
