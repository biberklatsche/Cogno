import { Injectable } from "@angular/core";
import { DatabaseAccess } from "@cogno/platform";

export interface SideMenuStateEntity {
  selected_item_label: string | null;
  is_pinned: number;
  displacement: number;
  panel_width_pixels: number;
}

@Injectable({ providedIn: "root" })
export class SideMenuStateRepository {
  constructor(private readonly databaseAccess: DatabaseAccess) {}

  /** `null` until the state has been saved once. */
  async load(): Promise<SideMenuStateEntity | null> {
    const rows = await this.databaseAccess.select<SideMenuStateEntity[]>(
      "SELECT selected_item_label, is_pinned, displacement, panel_width_pixels FROM side_menu_state WHERE id = 1",
    );
    return rows[0] ?? null;
  }

  async save(state: SideMenuStateEntity): Promise<void> {
    await this.databaseAccess.execute(
      `INSERT INTO side_menu_state (id, selected_item_label, is_pinned, displacement, panel_width_pixels)
       VALUES (1, ?1, ?2, ?3, ?4)
       ON CONFLICT (id) DO UPDATE SET
           selected_item_label = excluded.selected_item_label,
           is_pinned = excluded.is_pinned,
           displacement = excluded.displacement,
           panel_width_pixels = excluded.panel_width_pixels`,
      [state.selected_item_label, state.is_pinned, state.displacement, state.panel_width_pixels],
    );
  }
}
