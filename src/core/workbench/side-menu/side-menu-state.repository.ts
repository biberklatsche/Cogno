import { Injectable } from "@angular/core";
import { DatabaseAccess } from "@cogno/platform";

/** One panel that differs from the default: floating, default width. */
export interface SideMenuPanelEntity {
  label: string;
  is_pinned: number;
  width_pixels: number | null;
  /** A pinned panel that was open and comes back after a restart. */
  is_open: number;
}

@Injectable({ providedIn: "root" })
export class SideMenuStateRepository {
  constructor(private readonly databaseAccess: DatabaseAccess) {}

  async loadPanels(): Promise<SideMenuPanelEntity[]> {
    return this.databaseAccess.select<SideMenuPanelEntity[]>(
      "SELECT label, is_pinned, width_pixels, is_open FROM side_menu_panel",
    );
  }

  async savePanels(panels: ReadonlyArray<SideMenuPanelEntity>): Promise<void> {
    await this.databaseAccess.batch([
      { sql: "DELETE FROM side_menu_panel" },
      ...panels.map((panel) => ({
        sql: `INSERT INTO side_menu_panel (label, is_pinned, width_pixels, is_open)
              VALUES (?1, ?2, ?3, ?4)`,
        params: [panel.label, panel.is_pinned, panel.width_pixels, panel.is_open],
      })),
    ]);
  }
}
