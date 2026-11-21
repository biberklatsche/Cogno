import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SideMenuItem, SideMenuService } from "./side-menu.service";

class DummyComponent {}

describe("SideMenuService", () => {
  let bus: AppBus;
  let service: SideMenuService;
  let publishSpy: { mock: { calls: unknown[][] }; mockClear(): void };

  function item(label: string, order: number, extra: Partial<SideMenuItem> = {}): SideMenuItem {
    return {
      label,
      order,
      icon: "mdiViewDashboard",
      actionName: "open_workspace",
      component: DummyComponent,
      ...extra,
    };
  }

  function published(): string[] {
    return publishSpy.mock.calls.map((call) => {
      const message = call[0] as { type: string; payload?: { label?: string } };
      return message.payload?.label ? `${message.type} ${message.payload.label}` : message.type;
    });
  }

  function docked(): string[] {
    return service.dockedItems().map((menuItem) => menuItem.label);
  }

  beforeEach(() => {
    bus = new AppBus();
    service = new SideMenuService(bus);
    service.addMenuItem(item("Workspace", 1));
    service.addMenuItem(item("Git", 2));
    service.addMenuItem(item("Agents", 3));
    service.addMenuItem(item("Search", 4));
    service.addMenuItem(item("Settings", 1, { bottom: true }));
    publishSpy = vi.spyOn(bus, "publish");
  });

  function pin(label: string): void {
    service.open(label);
    service.togglePin(label);
  }

  it("opens a panel floating and gives it the keyboard", () => {
    service.open("Workspace");

    expect(service.floatingItem()?.label).toBe("Workspace");
    expect(docked()).toEqual([]);
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual(["SideMenuViewOpened Workspace", "SideMenuViewFocused Workspace"]);
  });

  it("replaces the floating panel with another floating one", () => {
    service.open("Workspace");
    publishSpy.mockClear();

    service.open("Search");

    expect(service.floatingItem()?.label).toBe("Search");
    expect(service.isOpen("Workspace")).toBe(false);
    expect(published()).toEqual([
      "SideMenuViewBlurred Workspace",
      "SideMenuViewClosed Workspace",
      "SideMenuViewOpened Search",
      "SideMenuViewFocused Search",
    ]);
  });

  it("keeps a pinned panel open beside a floating one", () => {
    pin("Workspace");

    service.open("Search");

    expect(docked()).toEqual(["Workspace"]);
    expect(service.floatingItem()?.label).toBe("Search");
    expect(service.focusedLabel()).toBe("Search");
  });

  it("stands pinned panels side by side in the rail's order, whatever order they opened in", () => {
    pin("Settings");
    pin("Agents");
    pin("Workspace");

    expect(docked()).toEqual(["Workspace", "Agents", "Settings"]);
    expect(service.floatingItem()).toBeUndefined();
  });

  it("only focuses a pinned panel that is open already", () => {
    pin("Workspace");
    service.blur();
    publishSpy.mockClear();

    service.open("Workspace");

    expect(published()).toEqual(["SideMenuViewFocused Workspace"]);
  });

  it("opens a closed panel that stayed pinned beside the others again", () => {
    pin("Workspace");
    service.close("Workspace");
    pin("Git");

    service.open("Workspace");

    expect(docked()).toEqual(["Workspace", "Git"]);
    expect(service.isPinned("Workspace")).toBe(true);
  });

  it("closes a pinned panel with X and leaves the floating one", () => {
    pin("Workspace");
    service.open("Search");
    service.focus("Workspace");
    publishSpy.mockClear();

    service.close("Workspace");

    expect(docked()).toEqual([]);
    expect(service.floatingItem()?.label).toBe("Search");
    expect(service.isPinned("Workspace")).toBe(true);
    expect(published()).toEqual([
      "SideMenuViewBlurred Workspace",
      "SideMenuViewClosed Workspace",
      "FocusActiveTerminal",
    ]);
  });

  it("does not take the keyboard to the terminal when an unfocused panel closes", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.close("Workspace");

    expect(service.focusedLabel()).toBe("Search");
    expect(published()).toEqual(["SideMenuViewClosed Workspace"]);
  });

  it("dismisses a floating panel by closing it, the pinned ones stay", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.dismiss("Search");

    expect(service.floatingItem()).toBeUndefined();
    expect(docked()).toEqual(["Workspace"]);
    expect(service.focusedLabel()).toBeUndefined();
    expect(published()).toEqual([
      "SideMenuViewBlurred Search",
      "SideMenuViewClosed Search",
      "FocusActiveTerminal",
    ]);
  });

  it("dismisses a pinned panel by giving the keyboard back to the terminal", () => {
    pin("Workspace");
    publishSpy.mockClear();

    service.dismiss("Workspace");

    expect(docked()).toEqual(["Workspace"]);
    expect(service.focusedLabel()).toBeUndefined();
    expect(published()).toEqual(["SideMenuViewBlurred Workspace", "FocusActiveTerminal"]);
  });

  it("leaves the keyboard alone when an unfocused pinned panel is dismissed", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.dismiss("Workspace");

    expect(service.focusedLabel()).toBe("Search");
    expect(published()).toEqual([]);
  });

  it("gives the keyboard to one panel at a time", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.focus("Workspace");

    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual(["SideMenuViewBlurred Search", "SideMenuViewFocused Workspace"]);
  });

  it("does not focus a panel that is not open", () => {
    service.focus("Workspace");

    expect(service.focusedLabel()).toBeUndefined();
  });

  it("pins the floating panel beside the others, and it stays open", () => {
    pin("Agents");
    service.open("Workspace");
    publishSpy.mockClear();

    service.togglePin("Workspace");

    expect(docked()).toEqual(["Workspace", "Agents"]);
    expect(service.floatingItem()).toBeUndefined();
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual([]);
  });

  it("unpins a panel into the floating one, replacing the panel floating so far", () => {
    pin("Workspace");
    pin("Agents");
    service.open("Search");
    service.focus("Workspace");
    publishSpy.mockClear();

    service.togglePin("Workspace");

    expect(docked()).toEqual(["Agents"]);
    expect(service.floatingItem()?.label).toBe("Workspace");
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual(["SideMenuViewClosed Search"]);
  });

  it("toggles a panel with its shortcut: open, focus when unfocused, close when focused", () => {
    service.toggle("Workspace");
    expect(service.focusedLabel()).toBe("Workspace");

    service.blur();
    service.toggle("Workspace");
    expect(service.focusedLabel()).toBe("Workspace");

    service.toggle("Workspace");
    expect(service.isOpen("Workspace")).toBe(false);
  });

  it("closes a focused pinned panel with its shortcut and keeps it pinned", () => {
    pin("Workspace");

    service.toggle("Workspace");
    expect(service.isOpen("Workspace")).toBe(false);

    service.toggle("Workspace");
    expect(docked()).toEqual(["Workspace"]);
  });

  it("ignores a panel without a menu item", () => {
    service.open("Unknown");

    expect(service.floatingItem()).toBeUndefined();
    expect(published()).toEqual([]);
  });

  it("follows a menu item that changes while its panel is open", () => {
    pin("Workspace");
    service.open("Search");

    service.updateBadgeColor("Workspace", "red");
    service.resolveComponent("Search", DummyComponent);

    expect(service.dockedItems()[0].badgeColor).toBe("red");
    expect(service.floatingItem()?.component).toBe(DummyComponent);
  });

  it("keeps a panel pinned while it is closed and re-registered", () => {
    pin("Workspace");
    service.close("Workspace");
    service.removeMenuItem("Workspace");
    service.addMenuItem(item("Workspace", 1, { icon: "mdiRobot" }));

    service.open("Workspace");

    expect(docked()).toEqual(["Workspace"]);
  });

  it("names the open pinned panels to bring back, not the floating one", () => {
    pin("Workspace");
    pin("Agents");
    service.open("Search");

    expect([...service.openPinnedLabels()].sort()).toEqual(["Agents", "Workspace"]);
  });

  it("restores pinned panels by label", () => {
    service.setPinnedLabels(["Workspace", "Git"]);

    service.open("Workspace", false);
    service.open("Git", false);

    expect(docked()).toEqual(["Workspace", "Git"]);
    expect(service.focusedLabel()).toBeUndefined();
  });

  it("keeps a width per panel and clamps it", () => {
    service.setPanelWidthInPixels("Workspace", 100);
    service.setPanelWidthInPixels("Git", 500);

    expect(service.panelWidthInPixels("Workspace")).toBe(280);
    expect(service.panelWidthInPixels("Git")).toBe(500);
    expect(service.panelWidthInPixels("Search")).toBe(360);
  });

  it("starts a panel at its own default width", () => {
    service.addMenuItem(item("Settings", 1, { bottom: true, defaultPanelWidthInPixels: 620 }));

    expect(service.panelWidthInPixels("Settings")).toBe(620);
  });

  it("expands a panel and toggles it back, per panel and while it is closed", () => {
    service.toggleExpanded("Workspace");
    expect(service.isExpanded("Workspace")).toBe(true);
    expect(service.isExpanded("Git")).toBe(false);

    service.toggleExpanded("Workspace");
    expect(service.expandedLabels().size).toBe(0);
  });
});
