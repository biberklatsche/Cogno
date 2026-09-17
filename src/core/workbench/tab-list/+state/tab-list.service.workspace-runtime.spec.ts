import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { defaultWorkspaceIdContract } from "@cogno/shared/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clear,
  getActionKeybindingPortMock,
  getAppBus,
  getConfigService,
  getDestroyRef,
} from "../../../../__test__/test-factory";
import type { Tab } from "../+model/tab";
import { TabListService } from "./tab-list.service";

/**
 * Pins the per-workspace runtime of the tab list: each workspace keeps its own
 * tabs, and they are activated, moved and removed with it.
 */
describe("TabListService workspace runtime", () => {
  let service: TabListService;
  let bus: AppBus;
  let tabs: Tab[];

  beforeEach(() => {
    bus = getAppBus();
    service = new TabListService(
      bus,
      getConfigService(),
      getActionKeybindingPortMock(),
      new ActionHandlers(bus, getDestroyRef()),
      getDestroyRef(),
    );
    service.tabs$.subscribe((value) => (tabs = value));
  });

  afterEach(() => {
    clear();
  });

  function tab(id: string, isActive = true): Tab {
    return { id, systemTitle: id, isActive, activeShellType: "unknown" };
  }

  function tabIds(): string[] {
    return tabs.map((entry) => entry.id);
  }

  it("keeps the tabs per workspace", () => {
    service.addTab(tab("t1"), true);

    service.activateWorkspace("ws-2");
    expect(tabs).toEqual([]);

    service.addTab(tab("t2"), true);
    expect(tabIds()).toEqual(["t2"]);
    expect(service.getTabConfigs(defaultWorkspaceIdContract).map((c) => c.tabId)).toEqual(["t1"]);

    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(tabIds()).toEqual(["t1"]);
  });

  it("closes an open rename when a workspace is activated", () => {
    service.addTab(tab("t1"), true);
    service
      .buildContextMenu("t1")
      .find((item) => item.label === "Rename tab")
      ?.action?.();
    expect(service.showRename$()).toBe("t1");

    service.activateWorkspace("ws-2");

    expect(service.showRename$()).toBeUndefined();
  });

  it("moves the tabs of the active workspace to the target", () => {
    service.addTab(tab("t1"), true);
    service.addTab(tab("t2"), true);

    service.moveActiveWorkspaceRuntime("ws-saved");

    expect(tabIds()).toEqual(["t1", "t2"]);
    expect(tabs.find((entry) => entry.isActive)?.id).toBe("t2");
    expect(service.getTabConfigs("ws-saved").map((c) => c.tabId)).toEqual(["t1", "t2"]);
    expect(service.getTabConfigs(defaultWorkspaceIdContract)).toEqual([]);

    // The target is the active workspace now: writes land there ...
    service.addTab(tab("t3"), true);
    expect(service.getTabConfigs("ws-saved").map((c) => c.tabId)).toEqual(["t1", "t2", "t3"]);

    // ... and the source starts empty when it is activated again.
    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(tabs).toEqual([]);
    service.activateWorkspace("ws-saved");
    expect(tabIds()).toEqual(["t1", "t2", "t3"]);
  });

  it("only activates when the move targets the active workspace", () => {
    service.addTab(tab("t1"), true);

    service.moveActiveWorkspaceRuntime(defaultWorkspaceIdContract);

    expect(tabIds()).toEqual(["t1"]);
    expect(service.getTabConfigs().map((c) => c.tabId)).toEqual(["t1"]);
  });

  it("removes the active workspace: the stream empties and writes are refused", () => {
    service.addTab(tab("t1"), true);

    service.removeWorkspaceRuntime(defaultWorkspaceIdContract);

    expect(tabs).toEqual([]);
    expect(() => service.addTab(tab("t2"), true)).toThrow(
      "No active workspace found for tab list.",
    );
    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(tabs).toEqual([]);
  });

  it("restores and removes an inactive workspace without touching the active one", () => {
    service.addTab(tab("t1"), true);
    let emissions = 0;
    service.tabs$.subscribe(() => emissions++);
    emissions = 0;

    service.restoreTabs([{ tabId: "t2", isActive: true }], "ws-2");
    expect(emissions).toBe(0);
    expect(service.getTabConfigs("ws-2").map((c) => c.tabId)).toEqual(["t2"]);

    service.removeWorkspaceRuntime("ws-2");
    expect(emissions).toBe(0);
    expect(service.getTabConfigs("ws-2")).toEqual([]);
    expect(tabIds()).toEqual(["t1"]);
  });

  it("is not affected by a caller changing a tab after handing it over", () => {
    const handedOver = tab("t1");
    service.addTab(handedOver, true);

    handedOver.systemTitle = "changed afterwards";

    expect(tabs[0].systemTitle).toBe("t1");
    expect(service.getTabConfigs()[0].systemTitle).toBe("t1");
  });

  it("emits a new list on every write", () => {
    service.addTab(tab("t1"), true);
    const before = tabs;

    service.setColor("t1", "blue");

    expect(tabs).not.toBe(before);
    expect(tabs[0].color).toBe("blue");
    expect(service.getTabConfigs()[0].color).toBe("blue");
  });
});
