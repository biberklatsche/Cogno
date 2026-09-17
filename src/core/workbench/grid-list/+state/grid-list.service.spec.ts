import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { FocusActiveTerminalAction } from "@cogno/core/workbench/bus/grid-list/actions";
import type {
  TabAddedEvent,
  TabRemovedEvent,
  TabSelectedEvent,
} from "@cogno/core/workbench/bus/tab-list/events";
import type { SessionHostFactory } from "@cogno/core/workbench/grid-list/+state/session-host-factory";
import type { TerminalConfig } from "@cogno/shared/domain";
import { IdCreator } from "@cogno/shared/support";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  emitSessionFact,
  getAppBus,
  getDestroyRef,
  getSessionHostFactory,
  getTerminalSessionRegistry,
} from "../../../../__test__/test-factory";
import type { Grid } from "../+model/model";
import { GridListService } from "./grid-list.service";

describe("GridListService", () => {
  let service: GridListService;
  let bus: AppBus;
  let componentFactory: SessionHostFactory;

  beforeEach(() => {
    bus = getAppBus();
    componentFactory = getSessionHostFactory();
    service = new GridListService(
      bus,
      componentFactory,
      getTerminalSessionRegistry(),
      getDestroyRef(),
    );
  });

  afterEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("Tab Event Handling", () => {
    it("should handle TabAdded event and restore grid", () => {
      const tabId = "tab-1";
      const workingDir = "/test/dir";

      bus.publish({
        type: "TabAdded",
        payload: { tabId, workingDir, isActive: true },
      } as TabAddedEvent);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));

      expect(grids.length).toBe(1);
      expect(grids[0].tabId).toBe(tabId);

      let activeTabId: string | undefined;
      service.activeTabId$.subscribe((id) => (activeTabId = id));
      expect(activeTabId).toBe(tabId);
    });

    it("should handle TabRemoved event", () => {
      const tabId = "tab-1";
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      bus.publish({
        type: "TabRemoved",
        payload: tabId,
      } as TabRemovedEvent);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids.length).toBe(0);
    });

    it("should handle TabSelected event", () => {
      const tabId = "tab-1";
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: false },
      } as TabAddedEvent);

      bus.publish({
        type: "TabSelected",
        payload: tabId,
      } as TabSelectedEvent);

      let activeTabId: string | undefined;
      service.activeTabId$.subscribe((id) => (activeTabId = id));
      expect(activeTabId).toBe(tabId);
    });

    it("should publish VisibleTerminalsChanged with an empty list when no tab is active", () => {
      let visibleTerminalIds: string[] | undefined;
      bus
        .onType$("VisibleTerminalsChanged")
        .subscribe((event) => (visibleTerminalIds = event.payload?.terminalIds));

      bus.publish({
        type: "TabAdded",
        payload: { tabId: "tab-1", isActive: false },
      } as TabAddedEvent);

      expect(visibleTerminalIds).toEqual([]);
    });

    it("should publish VisibleTerminalsChanged for the active tab including split panes", () => {
      let visibleTerminalIds: string[] | undefined;
      bus
        .onType$("VisibleTerminalsChanged")
        .subscribe((event) => (visibleTerminalIds = event.payload?.terminalIds));

      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      const tabId = "tab-1";
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      const initialTerminalId = grids[0].tree.root.data?.terminalId as string;

      service.split(initialTerminalId, "vertical", "r");

      expect(new Set(visibleTerminalIds)).toEqual(new Set([initialTerminalId, "term-2"]));
    });
  });

  describe("Split and Pane Management", () => {
    const tabId = "tab-1";
    let initialTerminalId: string;

    beforeEach(() => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      initialTerminalId = grids[0].tree.root.data?.terminalId as string;
    });

    it("should split pane right", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      const publishSpy = vi.spyOn(bus, "publish");

      service.split(initialTerminalId, "vertical", "r");

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));

      const root = grids[0].tree.root;
      expect(root.isLeaf).toBe(false);
      expect(root.data?.splitDirection).toBe("vertical");
      expect(root.left?.data?.terminalId).toBe(initialTerminalId);
      expect(root.right?.data?.terminalId).toBe("term-2");

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "BlurTerminal",
          payload: initialTerminalId,
        }),
      );
    });

    it("should remove a pane", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      // Split first so we have something to remove that isn't root
      service.split(initialTerminalId, "vertical", "r");

      const destroySpy = vi.spyOn(componentFactory, "destroy");

      service.removePane("term-2");

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));

      expect(grids[0].tree.root.isLeaf).toBe(true);
      expect(grids[0].tree.root.data?.terminalId).toBe(initialTerminalId);
      expect(destroySpy).toHaveBeenCalledWith("term-2");
    });

    it("should publish RemoveTab if root pane is removed", () => {
      const publishSpy = vi.spyOn(bus, "publish");

      service.removePane(initialTerminalId);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RemoveTab",
          payload: tabId,
        }),
      );
    });

    it("removes only the exited pane when the session exits and others remain", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");
      const destroySpy = vi.spyOn(componentFactory, "destroy");

      emitSessionFact("term-2", { type: "exited", exitCode: 0 });

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.isLeaf).toBe(true);
      expect(grids[0].tree.root.data?.terminalId).toBe(initialTerminalId);
      expect(destroySpy).toHaveBeenCalledWith("term-2");
    });

    it("removes the tab when the last pane's session exits", () => {
      const publishSpy = vi.spyOn(bus, "publish");

      emitSessionFact(initialTerminalId, { type: "exited", exitCode: 0 });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "RemoveTab", payload: tabId }),
      );
    });

    it("should split pane down", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "horizontal", "r");

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));

      const root = grids[0].tree.root;
      expect(root.isLeaf).toBe(false);
      expect(root.data?.splitDirection).toBe("horizontal");
      expect(root.left?.data?.terminalId).toBe(initialTerminalId);
      expect(root.right?.data?.terminalId).toBe("term-2");
    });

    it("should focus next pane on SelectNextPane", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");

      const publishSpy = vi.spyOn(bus, "publish");
      service.focusAdjacentPane(initialTerminalId, 1);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "FocusTerminal",
          payload: "term-2",
        }),
      );
    });

    it("should focus previous pane on SelectPreviousPane", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");

      const publishSpy = vi.spyOn(bus, "publish");
      service.focusAdjacentPane("term-2", -1);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "FocusTerminal",
          payload: initialTerminalId,
        }),
      );
    });

    it("should cycle all leaf panes in tree order for next/previous selection", () => {
      vi.spyOn(IdCreator, "newTerminalId")
        .mockReturnValueOnce("term-2")
        .mockReturnValueOnce("term-3");

      service.split(initialTerminalId, "vertical", "r");
      service.split(initialTerminalId, "vertical", "r");

      const publishSpy = vi.spyOn(bus, "publish");

      service.focusAdjacentPane(initialTerminalId, 1);
      service.focusAdjacentPane("term-3", 1);
      service.focusAdjacentPane("term-2", 1);
      service.focusAdjacentPane(initialTerminalId, -1);
      service.focusAdjacentPane("term-2", -1);
      service.focusAdjacentPane("term-3", -1);

      const focusedTerminals = publishSpy.mock.calls
        .map((call) => call[0])
        .filter((event) => event.type === "FocusTerminal")
        .map((event) => event.payload);

      expect(focusedTerminals).toEqual([
        "term-3",
        "term-2",
        initialTerminalId,
        "term-2",
        "term-3",
        initialTerminalId,
      ]);
    });

    it("should swap panes", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");

      service.swapPanes(initialTerminalId, "term-2");

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      const root = grids[0].tree.root;
      expect(root.left?.data?.terminalId).toBe("term-2");
      expect(root.right?.data?.terminalId).toBe(initialTerminalId);
    });

    it("should swap panes when pane swap drag is finished", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");

      service.startPaneSwapDrag(initialTerminalId);
      service.updatePaneSwapTarget("term-2");
      service.finishPaneSwapDrag();

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      const root = grids[0].tree.root;
      expect(root.left?.data?.terminalId).toBe("term-2");
      expect(root.right?.data?.terminalId).toBe(initialTerminalId);
    });

    it("should move pane swap source into a new tab", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      vi.spyOn(IdCreator, "newTabId").mockReturnValue("tab-moved");
      service.split(initialTerminalId, "vertical", "r");

      service.startPaneSwapDrag("term-2");
      service.movePaneSwapSourceToNewTab();

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids.length).toBe(2);
      const sourceGrid = grids.find((g) => g.tabId === tabId)!;
      const movedGrid = grids.find((g) => g.tabId === "tab-moved")!;
      expect(sourceGrid.tree.root.isLeaf).toBe(true);
      expect(sourceGrid.tree.root.data?.terminalId).toBe(initialTerminalId);
      expect(movedGrid.tree.root.data?.terminalId).toBe("term-2");
    });

    it("should handle titleChanged fact", () => {
      const publishSpy = vi.spyOn(bus, "publish");
      emitSessionFact(initialTerminalId, { type: "focusChanged", focused: true });

      emitSessionFact(initialTerminalId, { type: "titleChanged", oscCode: 2, title: "New Title" });

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.data?.title).toBe("New Title");
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ChangeTabTitle",
          payload: { tabId, title: "New Title" },
        }),
      );
    });

    it("should update pane title without changing tab title when pane is not focused", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");
      emitSessionFact(initialTerminalId, { type: "focusChanged", focused: true });

      const publishSpy = vi.spyOn(bus, "publish");
      emitSessionFact("term-2", { type: "titleChanged", oscCode: 2, title: "Second Pane" });

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.right?.data?.title).toBe("Second Pane");
      expect(publishSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ChangeTabTitle",
          payload: { tabId, title: "Second Pane" },
        }),
      );
    });

    it("should publish focused pane title on pane focus change", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");
      emitSessionFact(initialTerminalId, { type: "titleChanged", oscCode: 2, title: "First Pane" });
      emitSessionFact("term-2", { type: "titleChanged", oscCode: 2, title: "Second Pane" });

      const publishSpy = vi.spyOn(bus, "publish");
      emitSessionFact("term-2", { type: "focusChanged", focused: true });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ChangeTabTitle",
          payload: { tabId, title: "Second Pane" },
        }),
      );
    });

    it("should publish FocusTerminal after pane removal if focused", async () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      service.split(initialTerminalId, "vertical", "r");

      // Focus term-2
      emitSessionFact("term-2", { type: "focusChanged", focused: true });

      const publishSpy = vi.spyOn(bus, "publish");

      service.removePane("term-2");

      await vi.waitFor(() => {
        expect(publishSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "FocusTerminal",
            payload: initialTerminalId,
          }),
        );
      });
    });
  });

  describe("Config and Serialization", () => {
    it("should get and restore grid configs", () => {
      const tabId = "tab-1";
      bus.publish({
        type: "TabAdded",
        payload: { tabId, workingDir: "/home", isActive: true },
      } as TabAddedEvent);

      const configs = service.getGridConfigs();
      expect(configs.length).toBe(1);
      expect(configs[0].tabId).toBe(tabId);
      expect((configs[0].pane as TerminalConfig).workingDir).toBe("/home");
      expect((configs[0].pane as TerminalConfig).title).toBeUndefined();

      service.removeGrid(tabId);
      service.restoreGrids(configs);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids.length).toBe(1);
      expect(grids[0].tabId).toBe(tabId);
    });

    it("should serialize and restore pane titles", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);
      emitSessionFact("term-1", { type: "titleChanged", oscCode: 2, title: "Pane Title" });

      const configs = service.getGridConfigs();
      expect((configs[0].pane as TerminalConfig).title).toBe("Pane Title");

      service.removeGrid(tabId);
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-restored");
      service.restoreGrids(configs);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.data?.title).toBe("Pane Title");
    });
  });

  describe("Focus Management", () => {
    it("should toggle the maximize state", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      let maximizedTerminalId: string | undefined;
      service.maximizedTerminalId$.subscribe((value) => (maximizedTerminalId = value));
      service.togglePaneMaximize("term-1");
      expect(maximizedTerminalId).toBe("term-1");

      service.togglePaneMaximize("term-1");
      expect(maximizedTerminalId).toBeUndefined();
    });

    it("should handle focusChanged fact", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      emitSessionFact("term-1", { type: "focusChanged", focused: true });

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.data?.isFocused).toBe(true);
    });

    it("should ignore focusChanged facts from inactive tabs", () => {
      vi.spyOn(IdCreator, "newTerminalId")
        .mockReturnValueOnce("term-1")
        .mockReturnValueOnce("term-2");

      bus.publish({
        type: "TabAdded",
        payload: { tabId: "tab-1", isActive: true },
      } as TabAddedEvent);
      bus.publish({
        type: "TabAdded",
        payload: { tabId: "tab-2", isActive: false },
      } as TabAddedEvent);

      emitSessionFact("term-1", { type: "focusChanged", focused: true });

      emitSessionFact("term-2", { type: "focusChanged", focused: true });

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      const activeGrid = grids.find((g) => g.tabId === "tab-1")!;
      expect(activeGrid.tree.root.data?.isFocused).toBe(true);
    });

    it("should handle FocusActiveTerminal action", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      // Mock focused state
      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      grids[0].tree.root.data!.isFocused = true;

      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({
        type: "FocusActiveTerminal",
      } as FocusActiveTerminalAction);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "FocusTerminal",
          payload: "term-1",
        }),
      );
    });
  });
});
