import { describe, expect, it } from "vitest";
import type { SideMenuItem } from "../+state/side-menu.service";
import { isSelectedSideMenuItem } from "./side-menu.component";

class DummyComponent {}

describe("isSelectedSideMenuItem", () => {
  it("keeps the item selected after the menu item instance is replaced", () => {
    const selectedItem: SideMenuItem = {
      id: "notification",
      label: "Notification",
      icon: "mdiBell",
      hidden: false,
      pinned: false,
      actionName: "open_notification",
      component: DummyComponent,
    };

    const replacedMenuItem: SideMenuItem = {
      ...selectedItem,
      icon: "mdiBellBadge",
    };

    expect(selectedItem).not.toBe(replacedMenuItem);
    expect(isSelectedSideMenuItem(selectedItem, replacedMenuItem)).toBe(true);
  });

  it("falls back to the label when no stable id is present", () => {
    const selectedItem: SideMenuItem = {
      label: "AI Chat",
      icon: "mdiRobot",
      hidden: false,
      pinned: false,
      actionName: "open_ai_chat",
      component: DummyComponent,
    };

    const replacedMenuItem: SideMenuItem = {
      ...selectedItem,
      pinned: true,
    };

    expect(selectedItem).not.toBe(replacedMenuItem);
    expect(isSelectedSideMenuItem(selectedItem, replacedMenuItem)).toBe(true);
  });
});
