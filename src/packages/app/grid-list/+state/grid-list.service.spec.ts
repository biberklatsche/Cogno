import type { TerminalConfig } from "@cogno/core-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getAppBus,
  getDestroyRef,
  getTerminalComponentFactory,
} from "../../../__test__/test-factory";
import type { AppBus } from "../../app-bus/app-bus";
import { IdCreator } from "../../common/id-creator/id-creator";
import type { TabAddedEvent, TabRemovedEvent, TabSelectedEvent } from "../../tab-list/+bus/events";
import type { TerminalFocusedEvent } from "../../terminal/+state/handler/focus.handler";
import type { TerminalTitleChangedEvent } from "../../terminal/+state/handler/terminal-title.handler";
import type {
  FocusActiveTerminalAction,
  MaximizePaneAction,
  MinimizePaneAction,
  RemovePaneAction,
  SelectNextPaneAction,
  SelectPreviousPaneAction,
  SplitPaneDownAction,
  SplitPaneRightAction,
} from "../+bus/actions";
import type { Grid } from "../+model/model";
import { GridListService } from "./grid-list.service";
import type { TerminalComponentFactory } from "./terminal-component.factory";

describe("GridListService", () => {
  let service: GridListService;
  let bus: AppBus;
  let componentFactory: TerminalComponentFactory;

  beforeEach(() => {
    bus = getAppBus();
    componentFactory = getTerminalComponentFactory();
    service = new GridListService(bus, componentFactory, getDestroyRef());
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
      initialTerminalId = grids[0].tree.root.data?.terminalId;
    });

    it("should split pane right", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      const publishSpy = vi.spyOn(bus, "publish");

      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

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
      bus.publish({ type: "SplitPaneRight", payload: initialTerminalId } as SplitPaneRightAction);

      const destroySpy = vi.spyOn(componentFactory, "destroy");

      bus.publish({
        type: "RemovePane",
        payload: "term-2",
      } as RemovePaneAction);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));

      expect(grids[0].tree.root.isLeaf).toBe(true);
      expect(grids[0].tree.root.data?.terminalId).toBe(initialTerminalId);
      expect(destroySpy).toHaveBeenCalledWith("term-2");
    });

    it("should publish RemoveTab if root pane is removed", () => {
      const publishSpy = vi.spyOn(bus, "publish");

      bus.publish({
        type: "RemovePane",
        payload: initialTerminalId,
      } as RemovePaneAction);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RemoveTab",
          payload: tabId,
        }),
      );
    });

    it("should split pane down", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      bus.publish({
        type: "SplitPaneDown",
        payload: initialTerminalId,
      } as SplitPaneDownAction);

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
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({
        type: "SelectNextPane",
        payload: initialTerminalId,
      } as SelectNextPaneAction);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "FocusTerminal",
          payload: "term-2",
        }),
      );
    });

    it("should focus previous pane on SelectPreviousPane", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({
        type: "SelectPreviousPane",
        payload: "term-2",
      } as SelectPreviousPaneAction);

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

      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

      const publishSpy = vi.spyOn(bus, "publish");

      bus.publish({ type: "SelectNextPane", payload: initialTerminalId } as SelectNextPaneAction);
      bus.publish({ type: "SelectNextPane", payload: "term-3" } as SelectNextPaneAction);
      bus.publish({ type: "SelectNextPane", payload: "term-2" } as SelectNextPaneAction);
      bus.publish({
        type: "SelectPreviousPane",
        payload: initialTerminalId,
      } as SelectPreviousPaneAction);
      bus.publish({ type: "SelectPreviousPane", payload: "term-2" } as SelectPreviousPaneAction);
      bus.publish({ type: "SelectPreviousPane", payload: "term-3" } as SelectPreviousPaneAction);

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
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

      service.swapPanes(initialTerminalId, "term-2");

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      const root = grids[0].tree.root;
      expect(root.left?.data?.terminalId).toBe("term-2");
      expect(root.right?.data?.terminalId).toBe(initialTerminalId);
    });

    it("should swap panes when pane swap drag is finished", () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

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
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);

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

    it("should handle TerminalTitleChanged event", () => {
      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({ type: "TerminalFocused", payload: initialTerminalId } as TerminalFocusedEvent);

      bus.publish({
        type: "TerminalTitleChanged",
        payload: { oscCode: 0, terminalId: initialTerminalId, title: "New Title" },
      } as TerminalTitleChangedEvent);

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
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);
      bus.publish({ type: "TerminalFocused", payload: initialTerminalId } as TerminalFocusedEvent);

      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({
        type: "TerminalTitleChanged",
        payload: { oscCode: 0, terminalId: "term-2", title: "Second Pane" },
      } as TerminalTitleChangedEvent);

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
      bus.publish({
        type: "SplitPaneRight",
        payload: initialTerminalId,
      } as SplitPaneRightAction);
      bus.publish({
        type: "TerminalTitleChanged",
        payload: { oscCode: 0, terminalId: initialTerminalId, title: "First Pane" },
      } as TerminalTitleChangedEvent);
      bus.publish({
        type: "TerminalTitleChanged",
        payload: { oscCode: 0, terminalId: "term-2", title: "Second Pane" },
      } as TerminalTitleChangedEvent);

      const publishSpy = vi.spyOn(bus, "publish");
      bus.publish({ type: "TerminalFocused", payload: "term-2" } as TerminalFocusedEvent);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ChangeTabTitle",
          payload: { tabId, title: "Second Pane" },
        }),
      );
    });

    it("should publish FocusTerminal after pane removal if focused", async () => {
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-2");
      bus.publish({ type: "SplitPaneRight", payload: initialTerminalId } as SplitPaneRightAction);

      // Focus term-2
      bus.publish({ type: "TerminalFocused", payload: "term-2" } as TerminalFocusedEvent);

      const publishSpy = vi.spyOn(bus, "publish");

      bus.publish({
        type: "RemovePane",
        payload: "term-2",
      } as RemovePaneAction);

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
      bus.publish({
        type: "TerminalTitleChanged",
        payload: { oscCode: 0, terminalId: "term-1", title: "Pane Title" },
      } as TerminalTitleChangedEvent);

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
    it("should toggle maximize state when MaximizePane is fired repeatedly", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      let maximizedTerminalId: string | undefined;
      service.maximizedTerminalId$.subscribe((value) => (maximizedTerminalId = value));
      bus.publish({
        type: "MaximizePane",
        payload: "term-1",
      } as MaximizePaneAction);
      expect(maximizedTerminalId).toBe("term-1");

      bus.publish({
        type: "MaximizePane",
        payload: "term-1",
      } as MaximizePaneAction);
      expect(maximizedTerminalId).toBeUndefined();

      bus.publish({
        type: "MinimizePane",
        payload: "term-1",
      } as MinimizePaneAction);
      expect(maximizedTerminalId).toBeUndefined();
    });

    it("should handle TerminalFocused event", () => {
      const tabId = "tab-1";
      vi.spyOn(IdCreator, "newTerminalId").mockReturnValue("term-1");
      bus.publish({
        type: "TabAdded",
        payload: { tabId, isActive: true },
      } as TabAddedEvent);

      bus.publish({
        type: "TerminalFocused",
        payload: "term-1",
      } as TerminalFocusedEvent);

      let grids: Grid[] = [];
      service.grids$.subscribe((g) => (grids = g));
      expect(grids[0].tree.root.data?.isFocused).toBe(true);
    });

    it("should ignore TerminalFocused events from inactive tabs", () => {
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

      bus.publish({
        type: "TerminalFocused",
        payload: "term-1",
      } as TerminalFocusedEvent);

      bus.publish({
        type: "TerminalFocused",
        payload: "term-2",
      } as TerminalFocusedEvent);

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
