import { afterEach, describe, expect, it } from "vitest";
import type { SideMenuItem } from "./+state/side-menu.service";
import { focusPanel, isSelectedSideMenuItem, sideMenuTooltip } from "./side-menu.component";

class DummyComponent {}

describe("isSelectedSideMenuItem", () => {
  it("keeps the item selected after the menu item instance is replaced", () => {
    const selectedItem: SideMenuItem = {
      id: "notification",
      label: "Notification",
      icon: "mdiBell",
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
      actionName: "open_ai_chat",
      component: DummyComponent,
    };

    const replacedMenuItem: SideMenuItem = {
      ...selectedItem,
    };

    expect(selectedItem).not.toBe(replacedMenuItem);
    expect(isSelectedSideMenuItem(selectedItem, replacedMenuItem)).toBe(true);
  });
});

describe("focusPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function panelWithField() {
    const panel = document.createElement("aside");
    panel.tabIndex = -1;
    const field = document.createElement("input");
    panel.append(field);
    const terminal = document.createElement("textarea");
    document.body.append(panel, terminal);
    return { panel, field, terminal };
  }

  it("takes the keyboard to the panel when it is elsewhere", () => {
    const { panel, terminal } = panelWithField();
    terminal.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(panel);
  });

  it("leaves it in a field of the panel that a click just focused", () => {
    const { panel, field } = panelWithField();
    field.focus();

    focusPanel(panel);

    expect(document.activeElement).toBe(field);
  });
});

describe("sideMenuTooltip", () => {
  const item: SideMenuItem = {
    label: "Remote",
    icon: "mdiConnection",
    actionName: "open_remote",
    component: DummyComponent,
  };

  it("names a Pro feature as Pro", () => {
    expect(sideMenuTooltip({ ...item, pro: true })).toBe(
      "Remote (Pro, free during alpha and beta)",
    );
    expect(sideMenuTooltip(item)).toBe("Remote");
  });
});
