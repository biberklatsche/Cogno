import type { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import type { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { describe, expect, it, vi } from "vitest";
import { SETTINGS_PANEL_LABEL, SettingsPanelService } from "./settings-panel.service";

describe("SettingsPanelService", () => {
  it("puts the settings at the bottom of the side menu and toggles them on open_settings", () => {
    const sideMenu = { addMenuItem: vi.fn(), toggle: vi.fn() } as unknown as SideMenuService;
    const handlers = new Map<string, () => void>();
    const actions = {
      handle: vi.fn((name: string, handler: () => void) => handlers.set(name, handler)),
    } as unknown as ActionHandlers;

    new SettingsPanelService(sideMenu, actions);

    expect(sideMenu.addMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        label: SETTINGS_PANEL_LABEL,
        bottom: true,
        actionName: "open_settings",
      }),
    );
    handlers.get("open_settings")?.();
    expect(sideMenu.toggle).toHaveBeenCalledWith(SETTINGS_PANEL_LABEL);
  });
});
