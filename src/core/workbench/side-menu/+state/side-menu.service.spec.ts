import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SideMenuItem, SideMenuService } from "./side-menu.service";

class DummyComponent {}

describe("SideMenuService", () => {
  let bus: AppBus;
  let service: SideMenuService;
  let publishSpy: { mock: { calls: unknown[][] }; mockClear(): void };
  /** The Escape handlers bound right now, the latest on top, as the keybind service stacks them. */
  let escapeHandlers: { id: string; handler: () => void }[];

  function pressEscape(): void {
    escapeHandlers.at(-1)?.handler();
  }

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

  function openPinned(): string[] {
    const floating = service.floatingLabel();
    return service
      .openItems()
      .map((menuItem) => menuItem.label)
      .filter((label) => label !== floating);
  }

  beforeEach(() => {
    bus = new AppBus();
    escapeHandlers = [];
    const keybinds = {
      registerListener: (id: string, _keys: readonly string[], handler: () => void) => {
        escapeHandlers = [...escapeHandlers.filter((bound) => bound.id !== id), { id, handler }];
      },
      unregisterListener: (id: string) => {
        escapeHandlers = escapeHandlers.filter((bound) => bound.id !== id);
      },
    };
    service = new SideMenuService(bus, keybinds as unknown as KeybindService);
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

    expect(service.floatingLabel()).toBe("Workspace");
    expect(openPinned()).toEqual([]);
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual(["SideMenuViewOpened Workspace", "SideMenuViewFocused Workspace"]);
  });

  it("replaces the floating panel with another floating one", () => {
    service.open("Workspace");
    publishSpy.mockClear();

    service.open("Search");

    expect(service.floatingLabel()).toBe("Search");
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

    expect(openPinned()).toEqual(["Workspace"]);
    expect(service.floatingLabel()).toBe("Search");
    expect(service.focusedLabel()).toBe("Search");
  });

  it("stands pinned panels side by side in the rail's order, whatever order they opened in", () => {
    pin("Settings");
    pin("Agents");
    pin("Workspace");

    expect(openPinned()).toEqual(["Workspace", "Agents", "Settings"]);
    expect(service.floatingLabel()).toBeUndefined();
  });

  it("only focuses a pinned panel that is open already", () => {
    pin("Workspace");
    service.pointerDown(undefined);
    publishSpy.mockClear();

    service.open("Workspace");

    expect(published()).toEqual(["SideMenuViewFocused Workspace"]);
  });

  it("opens a closed panel that stayed pinned beside the others again", () => {
    pin("Workspace");
    service.close("Workspace");
    pin("Git");

    service.open("Workspace");

    expect(openPinned()).toEqual(["Workspace", "Git"]);
    expect(service.isPinned("Workspace")).toBe(true);
  });

  it("closes a pinned panel with X and leaves the floating one its keyboard", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.close("Workspace");

    expect(openPinned()).toEqual([]);
    expect(service.floatingLabel()).toBe("Search");
    expect(service.focusedLabel()).toBe("Search");
    expect(service.isPinned("Workspace")).toBe(true);
    expect(published()).toEqual(["SideMenuViewClosed Workspace"]);
  });

  it("closes the pinned panel that has the keyboard with X and gives it to the terminal", () => {
    pin("Workspace");
    publishSpy.mockClear();

    service.close("Workspace");

    expect(published()).toEqual([
      "SideMenuViewBlurred Workspace",
      "SideMenuViewClosed Workspace",
      "FocusActiveTerminal",
    ]);
  });

  it("dismisses a floating panel by closing it, the pinned ones stay", () => {
    pin("Workspace");
    service.open("Search");
    publishSpy.mockClear();

    service.dismiss("Search");

    expect(service.floatingLabel()).toBeUndefined();
    expect(openPinned()).toEqual(["Workspace"]);
    expect(service.focusedLabel()).toBeUndefined();
    expect(published()).toEqual([
      "SideMenuViewBlurred Search",
      "SideMenuViewClosed Search",
      "FocusActiveTerminal",
    ]);
  });

  describe("the pins of the last run", () => {
    it("move a panel that was opened floating before they arrived beside the terminals", () => {
      service.open("Search");
      publishSpy.mockClear();

      service.restorePinnedLabels(["Search"]);

      expect(service.floatingLabel()).toBeUndefined();
      expect(openPinned()).toEqual(["Search"]);
      // It stayed open and kept the keyboard: its feature hears nothing.
      expect(service.focusedLabel()).toBe("Search");
      expect(published()).toEqual([]);
    });

    it("are added to a pin set before they arrived", () => {
      pin("Git");

      service.restorePinnedLabels(["Workspace"]);

      expect(service.isPinned("Git")).toBe(true);
      expect(service.isPinned("Workspace")).toBe(true);
      expect(openPinned()).toEqual(["Git"]);
    });

    it("leave such a panel pinned, so dismissing it keeps it", () => {
      service.open("Search");
      service.restorePinnedLabels(["Search"]);

      service.dismiss("Search");

      expect(openPinned()).toEqual(["Search"]);
    });

    it("let it be unpinned again without closing it for its feature", () => {
      service.open("Search");
      service.restorePinnedLabels(["Search"]);
      publishSpy.mockClear();

      service.togglePin("Search");

      expect(service.floatingLabel()).toBe("Search");
      expect(published()).toEqual([]);
    });
  });

  describe("reopening the panels of the last run", () => {
    it("opens the pinned ones beside the terminals and leaves the keyboard alone", () => {
      service.restorePinnedLabels(["Workspace", "Git"]);
      publishSpy.mockClear();

      service.reopen(["Workspace", "Git"]);

      expect(openPinned()).toEqual(["Workspace", "Git"]);
      expect(service.focusedLabel()).toBeUndefined();
      expect(published()).toEqual(["SideMenuViewOpened Workspace", "SideMenuViewOpened Git"]);
    });

    it("opens a panel whose menu item comes later, as soon as it is there", () => {
      service.restorePinnedLabels(["Late"]);

      service.reopen(["Late"]);
      expect(openPinned()).toEqual([]);

      service.addMenuItem(item("Late", 9));
      expect(openPinned()).toEqual(["Late"]);
      expect(published()).toContain("SideMenuViewOpened Late");
    });

    it("keeps a panel that has not come yet among those to bring back", () => {
      service.restorePinnedLabels(["Late"]);

      service.reopen(["Late"]);

      expect([...service.labelsToBringBack()]).toEqual(["Late"]);
    });

    it("opens it only once: changing the menu item later does not bring it back", () => {
      service.restorePinnedLabels(["Late"]);
      service.reopen(["Late"]);
      service.addMenuItem(item("Late", 9));
      service.close("Late");

      service.addMenuItem(item("Late", 5));

      expect(openPinned()).toEqual([]);
    });

    it("does not bring back a panel that is no longer pinned", () => {
      service.reopen(["Workspace"]);

      expect(openPinned()).toEqual([]);
      expect(service.floatingLabel()).toBeUndefined();
    });
  });

  it("dismisses a pinned panel by giving the keyboard back to the terminal", () => {
    pin("Workspace");
    publishSpy.mockClear();

    service.dismiss("Workspace");

    expect(openPinned()).toEqual(["Workspace"]);
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
    pin("Git");
    publishSpy.mockClear();

    service.pointerDown("Workspace");

    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual(["SideMenuViewBlurred Git", "SideMenuViewFocused Workspace"]);
  });

  it("pins the floating panel beside the others, and it stays open", () => {
    pin("Agents");
    service.open("Workspace");
    publishSpy.mockClear();

    service.togglePin("Workspace");

    expect(openPinned()).toEqual(["Workspace", "Agents"]);
    expect(service.floatingLabel()).toBeUndefined();
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual([]);
  });

  it("unpins a panel into the floating one, which stays open with its keyboard", () => {
    pin("Workspace");
    pin("Agents");
    service.pointerDown("Workspace");
    publishSpy.mockClear();

    service.togglePin("Workspace");

    expect(openPinned()).toEqual(["Agents"]);
    expect(service.floatingLabel()).toBe("Workspace");
    expect(service.focusedLabel()).toBe("Workspace");
    expect(published()).toEqual([]);
  });

  it("toggles a floating panel with its shortcut or icon: open, then close, like a dialog", () => {
    service.toggle("Search");
    expect(service.floatingLabel()).toBe("Search");
    expect(service.focusedLabel()).toBe("Search");

    service.toggle("Search");
    expect(service.isOpen("Search")).toBe(false);
  });

  it("toggles the keyboard of a pinned panel with its shortcut or icon, and never closes it", () => {
    pin("Workspace");
    publishSpy.mockClear();

    service.toggle("Workspace");
    expect(openPinned()).toEqual(["Workspace"]);
    expect(service.focusedLabel()).toBeUndefined();
    expect(published()).toEqual(["SideMenuViewBlurred Workspace", "FocusActiveTerminal"]);

    service.toggle("Workspace");
    expect(openPinned()).toEqual(["Workspace"]);
    expect(service.focusedLabel()).toBe("Workspace");
  });

  it("ignores a panel without a menu item", () => {
    service.open("Unknown");

    expect(service.floatingLabel()).toBeUndefined();
    expect(published()).toEqual([]);
  });

  it("follows a menu item that changes while its panel is open", () => {
    pin("Workspace");
    service.open("Search");

    service.updateBadgeColor("Workspace", "red");
    service.resolveComponent("Search", DummyComponent);

    expect(service.openItems()[0].badgeColor).toBe("red");
    expect(service.openItems().find((open) => open.label === "Search")?.component).toBe(
      DummyComponent,
    );
  });

  it("keeps a panel pinned while it is closed and re-registered", () => {
    pin("Workspace");
    service.close("Workspace");
    service.removeMenuItem("Workspace");
    service.addMenuItem(item("Workspace", 1, { icon: "mdiRobot" }));

    service.open("Workspace");

    expect(openPinned()).toEqual(["Workspace"]);
  });

  it("names the open pinned panels to bring back, not the floating one", () => {
    pin("Workspace");
    pin("Agents");
    service.open("Search");

    expect([...service.labelsToBringBack()].sort()).toEqual(["Agents", "Workspace"]);
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

  describe("expand", () => {
    it("expands the panel that has the keyboard and restores it", () => {
      service.open("Workspace");

      service.toggleExpanding("Workspace");
      expect(service.isExpanded("Workspace")).toBe(true);

      service.toggleExpanding("Workspace");
      expect(service.isExpanded("Workspace")).toBe(false);
    });

    it("shows a panel at its size while it does not have the keyboard, so the terminal is seen", () => {
      pin("Workspace");
      service.toggleExpanding("Workspace");

      service.dismiss("Workspace");

      expect(service.isExpanded("Workspace")).toBe(false);
      expect(openPinned()).toEqual(["Workspace"]);
    });

    it("expands it again as soon as it has the keyboard back", () => {
      pin("Workspace");
      service.toggleExpanding("Workspace");
      service.dismiss("Workspace");

      service.toggle("Workspace");

      expect(service.isExpanded("Workspace")).toBe(true);
    });

    it("goes back to its size when another panel is opened, pinned or floating", () => {
      pin("Git");
      service.toggleExpanding("Git");

      service.open("Search");
      expect(service.isExpanded("Git")).toBe(false);

      service.pointerDown("Git");
      expect(service.isExpanded("Git")).toBe(true);

      pin("Workspace");
      expect(service.isExpanded("Git")).toBe(false);
    });

    it("expands only one panel at a time, also when several are set to expand", () => {
      pin("Workspace");
      service.toggleExpanding("Workspace");
      pin("Git");
      service.toggleExpanding("Git");

      expect(service.isExpanded("Git")).toBe(true);
      expect(service.isExpanded("Workspace")).toBe(false);
    });

    it("goes back to its size when a terminal takes the keyboard by itself", () => {
      pin("Workspace");
      service.toggleExpanding("Workspace");

      service.keyboardMovedTo(undefined);

      expect(service.isExpanded("Workspace")).toBe(false);
    });

    it("is kept for the panel: closed and opened again it is expanded", () => {
      service.open("Workspace");
      service.toggleExpanding("Workspace");
      service.close("Workspace");

      service.open("Workspace");

      expect(service.isExpanded("Workspace")).toBe(true);
    });

    it("comes back from the last run and leaves a panel that returns without the keyboard at its size", () => {
      service.restorePinnedLabels(["Git"]);
      service.restoreExpandingLabels(["Git"]);

      service.reopen(["Git"]);
      expect(service.isExpanded("Git")).toBe(false);
      expect([...service.expandingLabels()]).toEqual(["Git"]);

      service.toggle("Git");
      expect(service.isExpanded("Git")).toBe(true);
    });

    it("closes an expanded floating panel on dismiss, like any floating panel", () => {
      service.open("Search");
      service.toggleExpanding("Search");

      service.dismiss("Search");

      expect(service.floatingLabel()).toBeUndefined();
    });
  });

  describe("which pane has the keyboard", () => {
    it("is a pinned panel while it has it: the terminals do not", () => {
      pin("Workspace");
      expect(service.keyboardInPinnedPanel()).toBe(true);

      service.dismiss("Workspace");
      expect(service.keyboardInPinnedPanel()).toBe(false);
    });

    it("is not the floating panel: it lies over the panes like a dialog", () => {
      service.open("Search");

      expect(service.keyboardInPinnedPanel()).toBe(false);
    });
  });

  describe("selecting a panel by its icon or shortcut", () => {
    it("shows a pinned panel that the floating one lay over: the floating one closes", () => {
      pin("Workspace");
      service.open("Search");
      publishSpy.mockClear();

      service.toggle("Workspace");

      expect(service.floatingLabel()).toBeUndefined();
      expect(openPinned()).toEqual(["Workspace"]);
      expect(service.focusedLabel()).toBe("Workspace");
      // The keyboard goes straight to the pinned panel, not by the terminal.
      expect(published()).toEqual([
        "SideMenuViewBlurred Search",
        "SideMenuViewClosed Search",
        "SideMenuViewFocused Workspace",
      ]);
    });

    it("opens a pinned panel in place of the floating one that would lie over it", () => {
      service.restorePinnedLabels(["Git"]);
      service.open("Search");

      service.toggle("Git");

      expect(openPinned()).toEqual(["Git"]);
      expect(service.floatingLabel()).toBeUndefined();
    });

    it("leaves the pinned panels alone when the floating one is selected", () => {
      pin("Workspace");

      service.toggle("Search");

      expect(openPinned()).toEqual(["Workspace"]);
      expect(service.floatingLabel()).toBe("Search");
    });

    it("leaves a floating panel open while panels of the last run come back", () => {
      service.restorePinnedLabels(["Workspace"]);
      service.open("Search");

      service.reopen(["Workspace"]);

      expect(service.floatingLabel()).toBe("Search");
      expect(service.focusedLabel()).toBe("Search");
    });
  });

  describe("Escape", () => {
    it("closes the floating panel that has the keyboard", () => {
      service.open("Search");

      pressEscape();

      expect(service.floatingLabel()).toBeUndefined();
    });

    it("takes the keyboard from a pinned panel, which stays", () => {
      pin("Workspace");
      publishSpy.mockClear();

      pressEscape();

      expect(openPinned()).toEqual(["Workspace"]);
      expect(published()).toEqual(["SideMenuViewBlurred Workspace", "FocusActiveTerminal"]);
    });

    it("is the side menu's own rule, so a panel registered without a feature has it too", () => {
      service.open("Settings");

      pressEscape();

      expect(service.floatingLabel()).toBeUndefined();
    });

    it("is bound only while a panel has the keyboard", () => {
      expect(escapeHandlers).toEqual([]);

      service.open("Search");
      expect(escapeHandlers).toHaveLength(1);

      service.pointerDown(undefined);
      expect(escapeHandlers).toEqual([]);
    });

    it("follows the keyboard from one panel to the next", () => {
      pin("Workspace");
      service.open("Search");

      pressEscape();

      // Search had the keyboard, not Workspace.
      expect(service.floatingLabel()).toBeUndefined();
      expect(openPinned()).toEqual(["Workspace"]);
    });

    it("leaves Escape to a panel that binds it itself when it gets the keyboard", () => {
      const ownEscape = vi.fn();
      bus.on$("SideMenuViewFocused").subscribe(() => {
        escapeHandlers = [...escapeHandlers, { id: "feature.git", handler: ownEscape }];
      });

      service.open("Git");
      pressEscape();

      expect(ownEscape).toHaveBeenCalled();
      expect(service.floatingLabel()).toBe("Git");
    });
  });

  describe("the keyboard moving by itself", () => {
    it("to a terminal takes it from the pinned panel and frees Escape for the terminal", () => {
      pin("Workspace");
      publishSpy.mockClear();

      service.keyboardMovedTo(undefined);

      expect(service.focusedLabel()).toBeUndefined();
      expect(escapeHandlers).toEqual([]);
      expect(openPinned()).toEqual(["Workspace"]);
      // The terminal has the keyboard already; nobody is told to take it.
      expect(published()).toEqual(["SideMenuViewBlurred Workspace"]);
    });

    it("to a terminal leaves the floating panel open, without the keyboard", () => {
      service.open("Search");

      service.keyboardMovedTo(undefined);

      expect(service.floatingLabel()).toBe("Search");
      expect(service.focusedLabel()).toBeUndefined();
    });

    it("into another panel gives that one the keyboard", () => {
      pin("Workspace");
      pin("Git");

      service.keyboardMovedTo("Workspace");

      expect(service.focusedLabel()).toBe("Workspace");
    });

    it("lets the panel's shortcut bring the keyboard back instead of closing it", () => {
      pin("Workspace");
      service.keyboardMovedTo(undefined);

      service.toggle("Workspace");

      expect(service.isOpen("Workspace")).toBe(true);
      expect(service.focusedLabel()).toBe("Workspace");
    });
  });

  describe("the order of the open panels", () => {
    it("is the rail's, whichever was opened first and wherever each lies", () => {
      pin("Agents");
      pin("Workspace");
      service.open("Git");

      expect(service.openItems().map((menuItem) => menuItem.label)).toEqual([
        "Workspace",
        "Git",
        "Agents",
      ]);
    });

    it("does not change when a panel is pinned or unpinned, so its content stays in place", () => {
      pin("Agents");
      service.open("Workspace");
      const before = service.openItems().map((menuItem) => menuItem.label);

      service.togglePin("Workspace");
      expect(service.openItems().map((menuItem) => menuItem.label)).toEqual(before);

      service.togglePin("Workspace");
      expect(service.openItems().map((menuItem) => menuItem.label)).toEqual(before);
    });
  });

  describe("a pointer press", () => {
    it("on a pinned panel gives it the keyboard", () => {
      pin("Workspace");
      service.pointerDown(undefined);

      service.pointerDown("Workspace");

      expect(service.focusedLabel()).toBe("Workspace");
    });

    it("on a pinned panel closes the floating one, the keyboard going straight to the pinned", () => {
      pin("Workspace");
      service.open("Search");
      publishSpy.mockClear();

      service.pointerDown("Workspace");

      expect(service.floatingLabel()).toBeUndefined();
      expect(service.focusedLabel()).toBe("Workspace");
      expect(published()).not.toContain("FocusActiveTerminal");
    });

    it("on the floating panel leaves it open", () => {
      pin("Workspace");
      service.open("Search");

      service.pointerDown("Search");

      expect(service.floatingLabel()).toBe("Search");
      expect(openPinned()).toEqual(["Workspace"]);
    });

    it("beside every panel closes the floating one and keeps the pinned ones", () => {
      pin("Workspace");
      service.open("Search");
      publishSpy.mockClear();

      service.pointerDown(undefined);

      expect(service.floatingLabel()).toBeUndefined();
      expect(openPinned()).toEqual(["Workspace"]);
      expect(service.focusedLabel()).toBeUndefined();
      expect(published()).toContain("FocusActiveTerminal");
    });

    it("beside every panel takes the keyboard from a pinned one, which stays", () => {
      pin("Workspace");
      publishSpy.mockClear();

      service.pointerDown(undefined);

      expect(openPinned()).toEqual(["Workspace"]);
      expect(published()).toEqual(["SideMenuViewBlurred Workspace", "FocusActiveTerminal"]);
    });

    it("beside every panel changes nothing while no panel floats or has the keyboard", () => {
      pin("Workspace");
      service.pointerDown(undefined);
      publishSpy.mockClear();

      service.pointerDown(undefined);

      expect(published()).toEqual([]);
    });
  });
});
