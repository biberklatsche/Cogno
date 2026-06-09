import { Injectable } from "@angular/core";
import { DatabaseAccess } from "@cogno/core-api";

export interface SideMenuStateEntity {
  selected_item_label: string | null;
  is_pinned: number;
  displacement: number;
  panel_width_pixels: number;
}

@Injectable({ providedIn: "root" })
export class SideMenuStateRepository {
  constructor(private readonly databaseAccess: DatabaseAccess) {}

  async load(): Promise<SideMenuStateEntity | null> {
    const rows = await this.databaseAccess.select<SideMenuStateEntity[]>(
      "SELECT selected_item_label, is_pinned, displacement, panel_width_pixels FROM side_menu_state WHERE id = 1",
    );
    return rows[0] ?? null;
  }

  async save(state: SideMenuStateEntity): Promise<void> {
    await this.databaseAccess.execute(
      "UPDATE side_menu_state SET selected_item_label = ?, is_pinned = ?, displacement = ?, panel_width_pixels = ? WHERE id = 1",
      [state.selected_item_label, state.is_pinned, state.displacement, state.panel_width_pixels],
    );
  }
}
