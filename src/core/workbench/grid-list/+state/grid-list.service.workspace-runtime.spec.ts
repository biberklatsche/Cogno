import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { TabAddedEvent } from "@cogno/core/workbench/bus/tab-list/events";
import type { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import { defaultWorkspaceIdContract, type GridConfig } from "@cogno/shared/domain";
import { IdCreator } from "@cogno/shared/support";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getAppBus,
  getDestroyRef,
  getSessionHostFactory,
  getTerminalSessionRegistry,
} from "../../../../__test__/test-factory";
import type { Grid } from "../+model/model";
import { GridListService } from "./grid-list.service";

/**
 * Pins the per-workspace runtime of the grid list: what a workspace owns (its
 * grids, its active tab and its maximized pane) is activated, moved and
 * removed as one.
 */
describe("GridListService workspace runtime", () => {
  let service: GridListService;
  let bus: AppBus;
  let componentFactory: SessionHostFactory;
  let grids: Grid[];
  let activeTabId: string | undefined;
  let maximizedTerminalId: string | undefined;

  beforeEach(() => {
    bus = getAppBus();
    componentFactory = getSessionHostFactory();
    service = new GridListService(
      bus,
      componentFactory,
      getTerminalSessionRegistry(),
      getDestroyRef(),
    );
    service.grids$.subscribe((value) => (grids = value));
    service.activeTabId$.subscribe((value) => (activeTabId = value));
    service.maximizedTerminalId$.subscribe((value) => (maximizedTerminalId = value));
  });

  afterEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  function addActiveTab(tabId: string, terminalId: string): void {
    vi.spyOn(IdCreator, "newTerminalId").mockReturnValue(terminalId);
    bus.publish({ type: "TabAdded", payload: { tabId, isActive: true } } as TabAddedEvent);
  }

  function gridConfig(tabId: string, terminalId: string): GridConfig {
    return { tabId, pane: { terminalId } };
  }

  it("keeps grids, active tab and maximized pane per workspace", () => {
    addActiveTab("tab-1", "term-1");
    service.togglePaneMaximize("term-1");

    service.activateWorkspace("ws-2");
    expect(grids).toEqual([]);
    expect(activeTabId).toBeUndefined();
    expect(maximizedTerminalId).toBeUndefined();

    addActiveTab("tab-2", "term-2");
    expect(grids.map((grid) => grid.tabId)).toEqual(["tab-2"]);
    expect(activeTabId).toBe("tab-2");

    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(grids.map((grid) => grid.tabId)).toEqual(["tab-1"]);
    expect(activeTabId).toBe("tab-1");
    expect(maximizedTerminalId).toBe("term-1");
    expect(componentFactory.destroy).not.toHaveBeenCalled();
  });

  it("publishes the visible terminals of the activated workspace", () => {
    let visibleTerminalIds: string[] | undefined;
    bus
      .on$("VisibleTerminalsChanged")
      .subscribe((event) => (visibleTerminalIds = event.payload?.terminalIds));
    addActiveTab("tab-1", "term-1");
    expect(visibleTerminalIds).toEqual(["term-1"]);

    service.activateWorkspace("ws-2");
    expect(visibleTerminalIds).toEqual([]);

    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(visibleTerminalIds).toEqual(["term-1"]);
  });

  it("never lays out one terminal id twice: a restored duplicate gets a fresh id, loudly", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    addActiveTab("tab-1", "term-1");
    vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-fresh");

    service.restoreGridsForWorkspace(
      [gridConfig("tab-2", "term-1"), gridConfig("tab-3", "term-3")],
      "ws-2",
    );

    expect(service.terminalIdsForWorkspace(defaultWorkspaceIdContract)).toEqual(["term-1"]);
    expect(service.terminalIdsForWorkspace("ws-2")).toEqual(["term-fresh", "term-3"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("term-1");

    // Restoring a workspace over itself is not a duplicate: it keeps its ids.
    service.restoreGridsForWorkspace([gridConfig("tab-3", "term-3")], "ws-2");
    expect(service.terminalIdsForWorkspace("ws-2")).toEqual(["term-3"]);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("removes the active workspace: sessions end, the streams empty, writes are refused", () => {
    addActiveTab("tab-1", "term-1");
    service.togglePaneMaximize("term-1");

    service.removeWorkspaceRuntime(defaultWorkspaceIdContract);

    expect(componentFactory.destroy).toHaveBeenCalledWith("term-1");
    expect(grids).toEqual([]);
    expect(activeTabId).toBeUndefined();
    expect(maximizedTerminalId).toBeUndefined();
    expect(service.findWorkspaceIdentifierByTerminalId("term-1")).toBeUndefined();
    expect(() => service.restoreGrid(gridConfig("tab-2", "term-2"))).toThrow(
      "No active workspace found for grid list.",
    );

    service.activateWorkspace(defaultWorkspaceIdContract);
    expect(grids).toEqual([]);
    expect(activeTabId).toBeUndefined();
  });

  it("removes an inactive workspace without touching the active one", () => {
    addActiveTab("tab-1", "term-1");
    service.restoreGridsForWorkspace([gridConfig("tab-2", "term-2")], "ws-2");

    service.removeWorkspaceRuntime("ws-2");

    expect(componentFactory.destroy).toHaveBeenCalledTimes(1);
    expect(componentFactory.destroy).toHaveBeenCalledWith("term-2");
    expect(service.terminalIdsForWorkspace("ws-2")).toEqual([]);
    expect(grids.map((grid) => grid.tabId)).toEqual(["tab-1"]);
    expect(activeTabId).toBe("tab-1");
  });

  it("restores an inactive workspace without emitting and finds its terminals", () => {
    addActiveTab("tab-1", "term-1");
    let gridEmissions = 0;
    service.grids$.subscribe(() => gridEmissions++);
    gridEmissions = 0;

    service.restoreGridsForWorkspace(
      [
        {
          tabId: "tab-2",
          pane: {
            splitDirection: "vertical",
            ratio: 0.5,
            leftChild: { terminalId: "term-2" },
            rightChild: { terminalId: "term-3" },
          },
        },
      ],
      "ws-2",
    );

    expect(gridEmissions).toBe(0);
    expect(componentFactory.ensureSession).toHaveBeenCalledWith(
      expect.objectContaining({ terminalId: "term-3" }),
    );
    expect(service.terminalIdsForWorkspace("ws-2")).toEqual(["term-2", "term-3"]);
    expect(service.terminalIdsForWorkspace("unknown")).toEqual([]);
    expect(service.findWorkspaceIdentifierByTerminalId("term-3")).toBe("ws-2");
    expect(service.findTabIdByTerminalId("term-3")).toBe("tab-2");
    expect(service.findWorkspaceIdentifierByTerminalId("term-1")).toBe(defaultWorkspaceIdContract);
    expect(service.findTabIdByTerminalId("term-1")).toBe("tab-1");
    expect(service.findTabIdByTerminalId("missing")).toBeUndefined();

    // Replacing a workspace's grids ends the sessions it had before.
    service.restoreGridsForWorkspace([gridConfig("tab-4", "term-4")], "ws-2");
    expect(componentFactory.destroy).toHaveBeenCalledWith("term-2");
    expect(componentFactory.destroy).toHaveBeenCalledWith("term-3");
    expect(service.terminalIdsForWorkspace("ws-2")).toEqual(["term-4"]);
  });

  it("follows the selected tab with activeGridIsSplit$, without waiting for a grid write", () => {
    addActiveTab("tab-1", "term-1");
    service.split("term-1", "vertical", "r");
    service.restoreGrid(gridConfig("tab-2", "term-2"));
    let activeGridIsSplit: boolean | undefined;
    service.activeGridIsSplit$.subscribe((value) => (activeGridIsSplit = value));
    expect(activeGridIsSplit).toBe(true);

    service.selectGrid("tab-2");
    expect(activeGridIsSplit).toBe(false);

    service.selectGrid("tab-1");
    expect(activeGridIsSplit).toBe(true);
  });

  it("emits the grids on every grid write, not when only tab or maximize change", () => {
    addActiveTab("tab-1", "term-1");
    service.restoreGrid(gridConfig("tab-2", "term-2"));
    let gridEmissions = 0;
    service.grids$.subscribe(() => gridEmissions++);
    gridEmissions = 0;

    service.selectGrid("tab-2");
    service.togglePaneMaximize("term-2");
    service.togglePaneMaximize("term-2");
    expect(gridEmissions).toBe(0);

    service.split("term-2", "vertical", "r");
    expect(gridEmissions).toBe(1);

    service.activateWorkspace("ws-2");
    expect(gridEmissions).toBe(2);
  });
});
