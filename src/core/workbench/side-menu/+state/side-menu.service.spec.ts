import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SideMenuItem, SideMenuService } from "./side-menu.service";

class DummyComponent {}

describe("SideMenuService", () => {
  let bus: AppBus;
  let service: SideMenuService;
  let menuItem: SideMenuItem;

  beforeEach(() => {
    bus = new AppBus();
    service = new SideMenuService(bus);
    menuItem = {
      label: "Workspace",
      icon: "mdiViewDashboard",
      actionName: "open_workspace",
      component: DummyComponent,
    };
    service.addMenuItem(menuItem);
  });

  it("should focus when opening a side menu item", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isFocused()).toBe(true);
    expect(publishedTypes).toContain("SideMenuViewOpened");
    expect(publishedTypes).toContain("SideMenuViewFocused");
  });

  it("should only blur when pinned item loses outside focus", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    service.togglePin();
    service.blur();
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isPinned()).toBe(true);
    expect(service.isFocused()).toBe(false);
    expect(publishedTypes).toContain("SideMenuViewBlurred");
  });

  it("should close and blur on close()", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    service.close();
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()).toBeUndefined();
    expect(service.isFocused()).toBe(false);
    expect(publishedTypes).toContain("SideMenuViewClosed");
    expect(publishedTypes).toContain("SideMenuViewBlurred");
  });

  it("should only blur on close() when selected item is pinned", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    service.togglePin();
    publishSpy.mockClear();

    service.close();
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isPinned()).toBe(true);
    expect(service.isFocused()).toBe(false);
    expect(publishedTypes).toContain("SideMenuViewBlurred");
    expect(publishedTypes).not.toContain("SideMenuViewClosed");
  });

  it("should close pinned item when close is forced", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    service.togglePin();
    publishSpy.mockClear();

    service.close(true);
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()).toBeUndefined();
    expect(service.isFocused()).toBe(false);
    expect(publishedTypes).toContain("SideMenuViewClosed");
  });

  it("keeps a force-closed panel pinned when it is opened again", () => {
    service.open("Workspace");
    service.togglePin();
    service.close(true);

    service.open("Workspace");

    expect(service.isPinned()).toBe(true);
  });

  it("does not bring back a force-closed pinned panel until it is opened again", () => {
    service.addMenuItem({
      label: "Search",
      icon: "mdiConsole",
      actionName: "open_terminal_search",
      component: DummyComponent,
    });

    service.open("Workspace");
    service.togglePin();
    service.close(true);
    service.open("Search");
    service.close();

    expect(service.selectedItem()).toBeUndefined();

    service.open("Workspace");
    service.open("Search");
    service.close();

    expect(service.selectedItem()?.label).toBe("Workspace");
  });

  it("should re-focus the same item when open is called again", () => {
    const publishSpy = vi.spyOn(bus, "publish");

    service.open("Workspace");
    service.blur();
    publishSpy.mockClear();

    service.open("Workspace");
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isFocused()).toBe(true);
    expect(publishedTypes).toContain("SideMenuViewFocused");
    expect(publishedTypes).not.toContain("SideMenuViewOpened");
  });

  it("should blur the currently focused item when switching directly to another item", () => {
    service.addMenuItem({
      label: "CommandPalette",
      icon: "mdiConsole",
      actionName: "open_command_palette",
      component: DummyComponent,
    });

    service.open("Workspace");
    service.togglePin();
    expect(service.isFocused()).toBe(true);

    const publishSpy = vi.spyOn(bus, "publish");
    service.open("CommandPalette");
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    expect(service.selectedItem()?.label).toBe("CommandPalette");
    expect(service.isFocused()).toBe(true);
    expect(publishedTypes).toContain("SideMenuViewBlurred");
    expect(publishedTypes).toContain("SideMenuViewFocused");
  });

  it("should clamp side menu panel width", () => {
    service.open("Workspace");
    service.setPanelWidthInPixels(100);
    expect(service.panelWidthInPixels()).toBe(280);

    service.setPanelWidthInPixels(999);
    expect(service.panelWidthInPixels()).toBe(999);
  });

  it("keeps a width per panel", () => {
    service.addMenuItem({ ...menuItem, label: "Search" });
    service.open("Workspace");
    service.setPanelWidthInPixels(500);

    service.open("Search");
    expect(service.panelWidthInPixels()).toBe(360);

    service.open("Workspace");
    expect(service.panelWidthInPixels()).toBe(500);
  });

  it("names the docked panel to bring back, not a floating one over it", () => {
    service.addMenuItem({ ...menuItem, label: "Search" });
    expect(service.dockedPanelLabel()).toBeNull();

    service.open("Workspace");
    expect(service.dockedPanelLabel()).toBeNull();

    service.togglePin();
    service.open("Search");
    expect(service.dockedPanelLabel()).toBe("Workspace");

    service.open("Workspace");
    service.close(true);
    expect(service.dockedPanelLabel()).toBeNull();
  });

  it("reopens a pinned panel unfocused and focuses the terminal when a transient panel closes", () => {
    service.addMenuItem({
      label: "Search",
      icon: "mdiConsole",
      actionName: "open_terminal_search",
      component: DummyComponent,
    });

    // Pin Workspace, then open the transient Search over it.
    service.open("Workspace");
    service.togglePin();
    service.open("Search");
    expect(service.selectedItem()?.label).toBe("Search");

    const publishSpy = vi.spyOn(bus, "publish");
    service.close();
    const publishedTypes = publishSpy.mock.calls.map((call) => call[0].type);

    // The pinned panel comes back visible...
    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(publishedTypes).toContain("SideMenuViewOpened");
    // ...but does not grab the keyboard...
    expect(service.isFocused()).toBe(false);
    expect(publishedTypes).not.toContain("SideMenuViewFocused");
    // ...so the focus can return to the terminal.
    expect(publishedTypes).toContain("FocusActiveTerminal");
  });

  it("keeps a panel pinned while it is closed and re-registered", () => {
    service.open("Workspace");
    service.togglePin();
    service.close(true);
    service.removeMenuItem("Workspace");
    service.addMenuItem({ ...menuItem, icon: "mdiRobot" });

    service.open("Workspace");

    expect(service.isPinned()).toBe(true);
  });

  it("toggles a panel with its shortcut: open, focus when unfocused, close when focused", () => {
    service.toggle("Workspace");
    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isFocused()).toBe(true);

    service.blur();
    service.toggle("Workspace");
    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isFocused()).toBe(true);

    service.toggle("Workspace");
    expect(service.selectedItem()).toBeUndefined();
  });

  it("closes a focused pinned panel with its shortcut and keeps it pinned", () => {
    service.open("Workspace");
    service.togglePin();

    service.toggle("Workspace");
    expect(service.selectedItem()).toBeUndefined();

    service.toggle("Workspace");
    expect(service.isPinned()).toBe(true);
  });

  it("restores pinned panels by label", () => {
    service.setPinnedLabels(["Workspace"]);

    service.open("Workspace");
    service.close();

    expect(service.selectedItem()?.label).toBe("Workspace");
    expect(service.isPinned()).toBe(true);
  });

  it("expands the open panel and toggles it back", () => {
    service.open("Workspace");
    service.toggleExpanded();

    expect(service.isExpanded()).toBe(true);
    expect([...service.expandedLabels()]).toEqual(["Workspace"]);

    service.toggleExpanded();
    expect(service.isExpanded()).toBe(false);
    expect(service.expandedLabels().size).toBe(0);
  });

  it("keeps a panel expanded while it is closed and re-registered", () => {
    service.open("Workspace");
    service.toggleExpanded();
    service.close(true);
    service.removeMenuItem("Workspace");
    service.addMenuItem({ ...menuItem, icon: "mdiCog" });

    expect(service.isExpanded()).toBe(false);

    service.open("Workspace");
    expect(service.isExpanded()).toBe(true);
  });

  it("remembers expand per panel", () => {
    service.addMenuItem({ ...menuItem, label: "Git", actionName: "open_git" });
    service.open("Workspace");
    service.toggleExpanded();

    service.open("Git");
    expect(service.isExpanded()).toBe(false);

    service.setExpandedLabels(["Git"]);
    expect(service.isExpanded()).toBe(true);
    service.open("Workspace");
    expect(service.isExpanded()).toBe(false);
  });

  it("does nothing when expanding without an open panel", () => {
    service.toggleExpanded();

    expect(service.expandedLabels().size).toBe(0);
  });
});
