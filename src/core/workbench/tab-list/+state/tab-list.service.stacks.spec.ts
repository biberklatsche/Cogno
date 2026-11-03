import type { WritableSignal } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { AppMessage } from "@cogno/core/workbench/bus/messages";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getActionKeybindingPortMock,
  getAppBus,
  getConfigService,
  getDestroyRef,
} from "../../../../__test__/test-factory";
import { isStack, type Tab, type TabList, type TabStack } from "../+model/tab";
import { TabListService } from "./tab-list.service";

/**
 * Pins the stacks of the tab list: how tabs join and leave one, what a stack
 * stands for when collapsed, and how it is saved and restored.
 */
describe("TabListService stacks", () => {
  let service: TabListService;
  let bus: AppBus;
  let slots: TabList;
  let published: AppMessage[];

  beforeEach(() => {
    bus = getAppBus();
    published = [];
    bus.on$(["TabRemoved", "TabSelected"]).subscribe((message) => published.push(message));
    service = new TabListService(
      bus,
      getConfigService(),
      getActionKeybindingPortMock(),
      new ActionHandlers(bus, getDestroyRef()),
      getDestroyRef(),
    );
    service.activateWorkspace("ws-1");
    service.slots$.subscribe((value) => (slots = value));
  });

  afterEach(() => {
    clear();
  });

  function tab(id: string, isActive = false): Tab {
    return { id, systemTitle: id, isActive, activeShellType: "unknown" };
  }

  function addTabs(...ids: string[]): void {
    for (const id of ids) service.addTab(tab(id, id === ids[0]));
  }

  /** The bar as text: a tab by its id, a stack as `[member, member]`, the active tab starred. */
  function shape(): string {
    const text = (member: Tab) => (member.isActive ? `${member.id}*` : member.id);
    return slots
      .map((slot) => (isStack(slot) ? `[${slot.tabs.map(text).join(" ")}]` : text(slot)))
      .join(" ");
  }

  function stackAt(index: number): TabStack {
    const slot = slots[index];
    if (!isStack(slot)) throw new Error(`Slot ${index} is not a stack`);
    return slot;
  }

  /** `t1* t2 [t3 t4] t5` with t3 as the stack's current member. */
  function arrange(): string {
    addTabs("t1", "t2", "t3", "t4", "t5");
    service.stackTabs("t4", "t3");
    return stackAt(2).id;
  }

  describe("stackTabs", () => {
    it("puts a new stack holding both tabs in the target's place", () => {
      vi.spyOn(IdCreator, "newStackId").mockReturnValueOnce("TS-new");
      addTabs("t1", "t2", "t3");

      service.stackTabs("t1", "t3");

      expect(shape()).toBe("t2 [t3 t1*]");
      expect(stackAt(1)).toMatchObject({ id: "TS-new", currentTabId: "t1", isExpanded: false });
    });

    it("stands for the target while neither tab is active", () => {
      addTabs("t1", "t2", "t3");

      service.stackTabs("t2", "t3");

      expect(stackAt(1).currentTabId).toBe("t3");
    });

    it("dissolves the stack a tab is taken from when one member is left", () => {
      arrange();

      service.stackTabs("t4", "t1");

      expect(shape()).toBe("[t1* t4] t2 t3 t5");
    });

    it("never stacks a tab onto a stack or onto itself", () => {
      const stackId = arrange();

      service.stackTabs("t1", stackId);
      service.stackTabs("t1", "t1");

      expect(shape()).toBe("t1* t2 [t3 t4] t5");
    });
  });

  describe("placeSlot", () => {
    it("moves a tab or a whole stack before or after another slot", () => {
      const stackId = arrange();

      service.placeSlot("t5", "t1", "before");
      service.placeSlot(stackId, "t1", "after");

      expect(shape()).toBe("t5 t1* [t3 t4] t2");
    });

    it("takes a member out of its stack and puts it among the slots", () => {
      arrange();
      service.placeTabInStack("t5", stackAt(2).id, "t4", "after");

      service.placeSlot("t3", "t1", "before");

      expect(shape()).toBe("t3 t1* t2 [t4 t5]");
      expect(stackAt(3).currentTabId).toBe("t4");
    });

    it("dissolves the stack a member leaves when one member is left, and keeps the target's place", () => {
      const stackId = arrange();

      service.placeSlot("t3", stackId, "after");

      expect(shape()).toBe("t1* t2 t4 t3 t5");
    });

    it("writes nothing when the slot already is where it would go", () => {
      arrange();
      let writes = 0;
      service.slots$.subscribe(() => writes++);

      service.placeSlot("t1", "t2", "before");
      service.placeSlot("t2", "t1", "after");

      expect(writes).toBe(1);
    });
  });

  describe("placeTabInStack", () => {
    it("takes a tab from outside in before or after a member; the active one is then stood for", () => {
      const stackId = arrange();

      service.placeTabInStack("t1", stackId, "t3", "before");
      service.placeTabInStack("t5", stackId, "t4", "after");

      expect(shape()).toBe("t2 [t1* t3 t4 t5]");
      expect(stackAt(1).currentTabId).toBe("t1");
    });

    it("reorders a member within its stack without dissolving the stack", () => {
      const stackId = arrange();

      service.placeTabInStack("t4", stackId, "t3", "before");

      expect(shape()).toBe("t1* t2 [t4 t3] t5");
    });

    it("moves a member from one stack to another", () => {
      const first = arrange();
      service.stackTabs("t2", "t1");
      const second = stackAt(0).id;
      service.placeTabInStack("t5", second, "t2", "after");

      service.placeTabInStack("t3", second, "t1", "after");

      expect(shape()).toBe("[t1* t3 t2 t5] t4");
      expect(slots.some((slot) => slot.id === first)).toBe(false);
    });
  });

  describe("removing tabs", () => {
    it("activates the neighbour in the stack and lets the stack stand for it", () => {
      const stackId = arrange();
      service.placeTabInStack("t5", stackId, "t4", "after");
      service.selectTab("t4");
      published.length = 0;

      service.removeTab("t4");

      expect(shape()).toBe("t1 t2 [t3* t5]");
      expect(stackAt(2).currentTabId).toBe("t3");
      expect(published.map((message) => message.type)).toEqual(["TabRemoved", "TabSelected"]);
    });

    it("dissolves the stack when one member is left", () => {
      arrange();

      service.removeTab("t3");

      expect(shape()).toBe("t1* t2 t4 t5");
    });

    it("closes the whole stack and activates the slot before it", () => {
      const stackId = arrange();
      service.selectTab("t4");
      published.length = 0;

      service.closeStack(stackId);

      expect(shape()).toBe("t1 t2* t5");
      expect(published.map((message) => `${message.type}:${message.payload}`)).toEqual([
        "TabRemoved:t3",
        "TabRemoved:t4",
        "TabSelected:t2",
      ]);
    });

    it("keeps the kept tab as a slot of its own when all others are closed", () => {
      arrange();

      service.removeAllTabs("t3");

      expect(shape()).toBe("t3");
    });

    it("unstacks into slots in place", () => {
      const stackId = arrange();

      service.unstack(stackId);

      expect(shape()).toBe("t1* t2 t3 t4 t5");
    });
  });

  describe("selection", () => {
    it("select_tab_N picks the N-th slot; a stack stands for its current member", () => {
      arrange();

      bus.publish(ActionFired.create("select_tab_3"));
      expect(shape()).toBe("t1 t2 [t3* t4] t5");

      bus.publish(ActionFired.create("select_tab_4"));
      expect(shape()).toBe("t1 t2 [t3 t4] t5*");
    });

    it("walks through the members with next/previous tab and the stack follows along", () => {
      arrange();
      service.selectTab("t2");

      bus.publish(ActionFired.create("select_next_tab"));
      bus.publish(ActionFired.create("select_next_tab"));

      expect(shape()).toBe("t1 t2 [t3 t4*] t5");
      expect(stackAt(2).currentTabId).toBe("t4");
    });

    it("selectStack brings the current member to the front without touching what is shown", () => {
      const stackId = arrange();

      service.selectStack(stackId);

      expect(shape()).toBe("t1 t2 [t3* t4] t5");
      expect(stackAt(2).isExpanded).toBe(false);
    });

    it("toggleStack shows or hides the members; selecting elsewhere leaves that alone", () => {
      const stackId = arrange();

      service.toggleStack(stackId);
      expect(stackAt(2).isExpanded).toBe(true);
      expect(shape()).toBe("t1* t2 [t3 t4] t5");

      service.selectTab("t4");
      service.selectTab("t5");
      service.addTab(tab("t6", true));
      expect(stackAt(2).isExpanded).toBe(true);

      service.toggleStack(stackId);
      expect(stackAt(2).isExpanded).toBe(false);
    });
  });

  describe("naming", () => {
    function rename(id: string, value: string): void {
      (service as unknown as { _showRename: WritableSignal<string | undefined> })._showRename.set(
        id,
      );
      service.commitRename(value);
    }

    it("names a new stack after the smallest free number, never after a member", () => {
      addTabs("t1", "t2", "t3", "t4", "t5", "t6");
      service.stackTabs("t2", "t1");
      service.stackTabs("t4", "t3");
      service.stackTabs("t6", "t5");
      expect(slots.filter(isStack).map((stack) => stack.name)).toEqual([
        "Stack 1",
        "Stack 2",
        "Stack 3",
      ]);

      service.unstack(stackAt(1).id);
      service.stackTabs("t4", "t3");

      expect(stackAt(1).name).toBe("Stack 2");
    });

    it("renames a stack through the rename flow", () => {
      const stackId = arrange();

      rename(stackId, "backend");

      expect(stackAt(2).name).toBe("backend");
      expect(service.showRename$()).toBeUndefined();
    });

    it("offers the stack's own menu, with the colour picker as its custom item", () => {
      const stackId = arrange();

      const menu = service.buildStackContextMenu(stackId);

      expect(menu.map((item) => item.label)).toEqual([
        "Close stack",
        "Unstack",
        undefined,
        "Rename stack",
        undefined,
        undefined,
      ]);
      expect(menu.at(-1)?.custom).toBe(true);
    });

    it("colours a stack on its own, apart from its members", () => {
      const stackId = arrange();

      service.setStackColor(stackId, "red");

      expect(stackAt(2).color).toBe("red");
      expect(stackAt(2).tabs.every((member) => member.color === undefined)).toBe(true);
    });
  });

  describe("persistence", () => {
    it("saves members with their stack id and the stacks with their names, and restores them", () => {
      const stackId = arrange();
      service.placeTabInStack("t5", stackId, "t4", "after");
      service.selectTab("t4");
      (service as unknown as { _showRename: WritableSignal<string | undefined> })._showRename.set(
        stackId,
      );
      service.commitRename("backend");
      service.setStackColor(stackId, "blue");
      service.toggleStack(stackId);

      const tabs = service.getTabConfigs();
      const stacks = service.getTabStackConfigs();
      expect(tabs.map((config) => `${config.tabId}:${config.stackId}`)).toEqual([
        "t1:undefined",
        "t2:undefined",
        `t3:${stackId}`,
        `t4:${stackId}`,
        `t5:${stackId}`,
      ]);
      expect(stacks).toEqual([
        { stackId, name: "backend", color: "blue", currentTabId: "t4", isExpanded: true },
      ]);

      service.restoreTabs(tabs, stacks, "ws-2");
      service.activateWorkspace("ws-2");

      expect(shape()).toBe("t1 t2 [t3 t4* t5]");
      expect(stackAt(2)).toMatchObject({
        id: stackId,
        name: "backend",
        color: "blue",
        currentTabId: "t4",
        isExpanded: true,
      });
    });

    it("restores the member a stack stood for while another slot was active", () => {
      service.restoreTabs(
        [
          { tabId: "a", isActive: true },
          { tabId: "b", stackId: "S-1" },
          { tabId: "c", stackId: "S-1" },
          { tabId: "d", stackId: "S-2" },
          { tabId: "e", stackId: "S-2" },
        ],
        [
          { stackId: "S-1", currentTabId: "c" },
          { stackId: "S-2", currentTabId: "gone" },
        ],
        "ws-2",
      );
      service.activateWorkspace("ws-2");

      expect(stackAt(1).currentTabId).toBe("c");
      expect(stackAt(2).currentTabId).toBe("d");
    });

    it("repairs what it restores: a lone member becomes a tab, members join at the first one's place", () => {
      service.restoreTabs(
        [
          { tabId: "a", stackId: "S-1" },
          { tabId: "b", stackId: "S-2" },
          { tabId: "c" },
          { tabId: "d", stackId: "S-2" },
        ],
        [{ stackId: "S-2", name: "two" }, { stackId: "S-3" }],
        "ws-2",
      );
      service.activateWorkspace("ws-2");

      expect(shape()).toBe("a [b d] c");
      expect(stackAt(1)).toMatchObject({ name: "two", currentTabId: "b" });
      expect(service.getTabStackConfigs()).toEqual([
        { stackId: "S-2", name: "two", currentTabId: "b", isExpanded: false },
      ]);
    });

    it("names a restored stack that has none, clear of every name a later stack carries", () => {
      service.restoreTabs(
        [
          { tabId: "a", stackId: "S-1" },
          { tabId: "b", stackId: "S-1" },
          { tabId: "c", stackId: "S-2" },
          { tabId: "d", stackId: "S-2" },
        ],
        [{ stackId: "S-1" }, { stackId: "S-2", name: "Stack 1" }],
        "ws-2",
      );
      service.activateWorkspace("ws-2");

      expect(slots.filter(isStack).map((stack) => stack.name)).toEqual(["Stack 2", "Stack 1"]);
    });
  });

  it("adds a new tab as a slot of its own, after the stack", () => {
    arrange();
    service.selectTab("t3");

    service.addTab(tab("t6", true));

    expect(shape()).toBe("t1 t2 [t3 t4] t5 t6*");
  });
});
