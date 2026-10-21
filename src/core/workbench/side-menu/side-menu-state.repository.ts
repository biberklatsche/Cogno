import { Injectable } from "@angular/core";
import { DatabaseAccess } from "@cogno/platform";

/** One panel that differs from the default: floating, default width, not expanded. */
export interface SideMenuPanelEntity {
  label: string;
  is_pinned: number;
  is_expanded: number;
  width_pixels: number | null;
  /** The docked panel that comes back after a restart; at most one row. */
  is_open: number;
}

@Injectable({ providedIn: "root" })
export class SideMenuStateRepository {
  constructor(private readonly databaseAccess: DatabaseAccess) {}

  async loadPanels(): Promise<SideMenuPanelEntity[]> {
    return this.databaseAccess.select<SideMenuPanelEntity[]>(
      "SELECT label, is_pinned, is_expanded, width_pixels, is_open FROM side_menu_panel",
    );
  }

  async savePanels(panels: ReadonlyArray<SideMenuPanelEntity>): Promise<void> {
    await this.databaseAccess.batch([
      { sql: "DELETE FROM side_menu_panel" },
      ...panels.map((panel) => ({
        sql: `INSERT INTO side_menu_panel (label, is_pinned, is_expanded, width_pixels, is_open)
              VALUES (?1, ?2, ?3, ?4, ?5)`,
        params: [
          panel.label,
          panel.is_pinned,
          panel.is_expanded,
          panel.width_pixels,
          panel.is_open,
        ],
      })),
    ]);
  }
}
