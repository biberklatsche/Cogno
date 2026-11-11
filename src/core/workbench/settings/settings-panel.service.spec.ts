import type { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import type { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsNavigation } from "./settings-navigation";
import { SETTINGS_PANEL_LABEL, SettingsPanelService } from "./settings-panel.service";

describe("SettingsPanelService", () => {
  type Handler = (context: { args?: string[] }) => void;
  let sideMenu: SideMenuService;
  let navigation: SettingsNavigation;
  let handlers: Map<string, Handler>;

  beforeEach(() => {
    sideMenu = {
      addMenuItem: vi.fn(),
      toggle: vi.fn(),
      open: vi.fn(),
    } as unknown as SideMenuService;
    navigation = new SettingsNavigation();
    handlers = new Map();
    const actions = {
      handle: vi.fn((name: string, handler: Handler) => handlers.set(name, handler)),
    } as unknown as ActionHandlers;
    new SettingsPanelService(sideMenu, actions, navigation);
  });

  it("puts the settings at the bottom of the side menu and toggles them on open_settings", () => {
    expect(sideMenu.addMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        label: SETTINGS_PANEL_LABEL,
        bottom: true,
        actionName: "open_settings",
      }),
    );
    handlers.get("open_settings")?.({});
    expect(sideMenu.toggle).toHaveBeenCalledWith(SETTINGS_PANEL_LABEL);
    expect(navigation.requestedKey()).toBeUndefined();
  });

  it("opens the settings at a key's section when open_settings names one", () => {
    handlers.get("open_settings")?.({ args: ["notification"] });

    expect(navigation.requestedKey()).toBe("notification");
    expect(sideMenu.open).toHaveBeenCalledWith(SETTINGS_PANEL_LABEL);
    expect(sideMenu.toggle).not.toHaveBeenCalled();
  });
});
