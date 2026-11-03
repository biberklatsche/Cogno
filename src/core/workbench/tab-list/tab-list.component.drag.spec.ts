import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { DragPreviewService } from "@cogno/core/workbench/drag-preview/drag-preview.service";
import type { Tab, TabList } from "@cogno/core/workbench/tab-list/+model/tab";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { ContextMenuOverlayService } from "@cogno/shared/ui";
import { Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { type DragTarget, TabListComponent } from "./tab-list.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const tabRectangle = { width: 120, height: 24 } as DOMRect;

function tab(id: string, isActive = false): Tab {
  return { id, systemTitle: id, isActive, activeShellType: "unknown" };
}

/** Two tabs and a stack of two: `t1 | t2 | s1[t3, t4]`. */
const slots: TabList = [
  tab("t1", true),
  tab("t2"),
  {
    id: "s1",
    name: "Stack 1",
    currentTabId: "t3",
    isExpanded: false,
    tabs: [tab("t3"), tab("t4")],
  },
];

function mouseDown(
  overrides: Partial<{
    button: number;
    clientX: number;
    clientY: number;
    target: EventTarget;
  }> = {},
): MouseEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  const currentTarget = document.createElement("div");
  vi.spyOn(currentTarget, "getBoundingClientRect").mockReturnValue(tabRectangle);
  return {
    button: 0,
    clientX: 100,
    clientY: 100,
    target: currentTarget,
    currentTarget,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

/** A pointer move over a 100px wide slot, `share` of the way from its left edge. */
function moveOver(share: number, buttons = 1): MouseEvent {
  const currentTarget = document.createElement("button");
  vi.spyOn(currentTarget, "getBoundingClientRect").mockReturnValue({
    left: 200,
    width: 100,
  } as DOMRect);
  return { buttons, clientX: 200 + share * 100, currentTarget } as unknown as MouseEvent;
}

const slot = (id: string): DragTarget => ({ kind: "slot", id });
const segment = (id: string, stackId: string): DragTarget => ({ kind: "segment", id, stackId });

/** Counts the listeners added to `window` from now on that were not removed again. */
function trackWindowListeners(): () => number {
  const listeners: unknown[] = [];
  const active = new Set<string>();
  const key = (type: string, listener: unknown) => {
    if (!listeners.includes(listener)) listeners.push(listener);
    return `${type}:${listeners.indexOf(listener)}`;
  };
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  const addSpy = vi.spyOn(window, "addEventListener").mockImplementation(((
    type: string,
    listener: EventListener,
    options?: boolean,
  ) => {
    active.add(key(type, listener));
    add(type, listener, options);
  }) as typeof window.addEventListener);
  const removeSpy = vi.spyOn(window, "removeEventListener").mockImplementation(((
    type: string,
    listener: EventListener,
    options?: boolean,
  ) => {
    active.delete(key(type, listener));
    remove(type, listener, options);
  }) as typeof window.removeEventListener);
  onTestFinished(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
  return () => active.size;
}

function windowMouse(type: "mousemove" | "mouseup", clientX: number, clientY: number, button = 0) {
  window.dispatchEvent(new MouseEvent(type, { clientX, clientY, button, bubbles: true }));
}

/**
 * Pins the press / threshold / drag / drop behaviour of the tab strip: a press
 * released in place is a click, a drag reorders over the edges of a slot and
 * stacks over its middle.
 */
describe("TabListComponent drag interaction", () => {
  let component: TabListComponent;
  let showRename: ReturnType<typeof vi.fn>;
  let tabListService: {
    slots$: Observable<TabList>;
    showRename$: ReturnType<typeof vi.fn>;
    selectTab: ReturnType<typeof vi.fn>;
    selectStack: ReturnType<typeof vi.fn>;
    focusActiveTerminal: ReturnType<typeof vi.fn>;
    placeSlot: ReturnType<typeof vi.fn>;
    placeTabInStack: ReturnType<typeof vi.fn>;
    stackTabs: ReturnType<typeof vi.fn>;
    stackOfTab: ReturnType<typeof vi.fn>;
  };
  let dragPreview: {
    startDragPreview: ReturnType<typeof vi.fn>;
    updateDragPreviewPosition: ReturnType<typeof vi.fn>;
    stopDragPreview: ReturnType<typeof vi.fn>;
  };

  /** Presses `id` and moves past the threshold, so the slot is being dragged. */
  function drag(id: string, kind: "tab" | "stack" = "tab"): void {
    component.startSlotDrag(mouseDown(), id, kind);
    windowMouse("mousemove", 110, 100);
  }

  beforeEach(() => {
    showRename = vi.fn().mockReturnValue(undefined);
    tabListService = {
      slots$: of(slots),
      showRename$: showRename,
      selectTab: vi.fn(),
      selectStack: vi.fn(),
      focusActiveTerminal: vi.fn(),
      placeSlot: vi.fn(),
      placeTabInStack: vi.fn(),
      stackTabs: vi.fn(),
      stackOfTab: vi.fn((id: string) =>
        slots.filter((s) => "tabs" in s).find((s) => s.tabs.some((t) => t.id === id)),
      ),
    };
    dragPreview = {
      startDragPreview: vi.fn(),
      updateDragPreviewPosition: vi.fn(),
      stopDragPreview: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(
      () =>
        new TabListComponent(
          tabListService as unknown as TabListService,
          { openAtElement: vi.fn() } as unknown as ContextMenuOverlayService,
          dragPreview as unknown as DragPreviewService,
          { forTab$: vi.fn() } as unknown as BusyIndicatorService,
        ),
    );
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it("keeps terminal focus on press: prevents the default and refocuses the terminal", () => {
    const event = mouseDown();

    component.startSlotDrag(event, "t1", "tab");

    expect(event.preventDefault).toHaveBeenCalled();
    expect(tabListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
  });

  it("selects the tab when the pointer is released without moving", () => {
    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).toHaveBeenCalledExactlyOnceWith("t1");
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(component.dragged()).toBeUndefined();
  });

  it("brings the stack's current member to the front when its head is released without moving", () => {
    component.startSlotDrag(mouseDown(), "s1", "stack");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectStack).toHaveBeenCalledExactlyOnceWith("s1");
    expect(tabListService.selectTab).not.toHaveBeenCalled();
  });

  it("does not start a drag below the 4px threshold", () => {
    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mousemove", 103, 97);

    expect(component.dragged()).toBeUndefined();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();

    windowMouse("mouseup", 103, 97);
    expect(tabListService.selectTab).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it.each([
    ["horizontally", 104, 100],
    ["vertically", 100, 96],
  ])("starts the drag once the pointer moved 4px %s", (_axis, clientX, clientY) => {
    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mousemove", clientX, clientY);

    expect(component.dragged()).toEqual({ id: "t1", isStack: false });
    expect(dragPreview.startDragPreview).toHaveBeenCalledExactlyOnceWith(
      tabRectangle,
      clientX,
      clientY,
    );
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenCalledWith(clientX, clientY);
  });

  it("only moves the preview on further pointer moves", () => {
    drag("t1");
    windowMouse("mousemove", 150, 120);

    expect(dragPreview.startDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenLastCalledWith(150, 120);
  });

  it("ends the drag on release without selecting the tab", () => {
    drag("t1");
    tabListService.focusActiveTerminal.mockClear();

    windowMouse("mouseup", 110, 100);

    expect(component.dragged()).toBeUndefined();
    expect(tabListService.selectTab).not.toHaveBeenCalled();
    expect(tabListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("stops listening after the release", () => {
    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mouseup", 100, 100);
    dragPreview.updateDragPreviewPosition.mockClear();

    windowMouse("mousemove", 200, 200);
    windowMouse("mouseup", 200, 200);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
    expect(tabListService.selectTab).toHaveBeenCalledTimes(1);
  });

  it("neither selects nor keeps listening when another button is released", () => {
    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mouseup", 100, 100, 2);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();

    windowMouse("mousemove", 200, 200);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press with another button", () => {
    const event = mouseDown({ button: 2 });

    component.startSlotDrag(event, "t1", "tab");
    windowMouse("mousemove", 200, 200);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press on the tab that is being renamed", () => {
    showRename.mockReturnValue("t1");

    component.startSlotDrag(mouseDown(), "t1", "tab");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
  });

  it.each([
    ".close",
    ".inline-input",
    ".stack-chevron",
  ])("ignores a press inside %s", (selector) => {
    const control = document.createElement("span");
    control.className = selector.slice(1);
    const inner = document.createElement("i");
    control.appendChild(inner);

    component.startSlotDrag(mouseDown({ target: inner }), "t1", "tab");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
  });

  describe("dragOver", () => {
    it("reorders over the outer quarters of another slot: before on the left, after on the right", () => {
      drag("t1");

      component.dragOver(moveOver(0.1), slot("t2"));
      component.dragOver(moveOver(0.9), slot("s1"));

      expect(tabListService.placeSlot).toHaveBeenNthCalledWith(1, "t1", "t2", "before");
      expect(tabListService.placeSlot).toHaveBeenNthCalledWith(2, "t1", "s1", "after");
      expect(component.stackTarget()).toBeUndefined();
    });

    it("asks the service once per zone crossing, not on every pointer move", () => {
      drag("t1");

      component.dragOver(moveOver(0.1), slot("t2"));
      component.dragOver(moveOver(0.2), slot("t2"));
      component.dragOver(moveOver(0.9), slot("t2"));
      component.dragOver(moveOver(0.1), slot("t2"));
      component.dragOver(moveOver(0.3), segment("t3", "s1"));
      component.dragOver(moveOver(0.4), segment("t3", "s1"));

      expect(tabListService.placeSlot).toHaveBeenCalledTimes(3);
      expect(tabListService.placeTabInStack).toHaveBeenCalledTimes(1);
    });

    it("marks the slot as the stack to join over its middle, without reordering", () => {
      drag("t1");

      component.dragOver(moveOver(0.5), slot("t2"));

      expect(component.stackTarget()).toBe("t2");
      expect(tabListService.placeSlot).not.toHaveBeenCalled();
    });

    it("stacks the dragged tab onto a tab it is released over", () => {
      drag("t1");
      component.dragOver(moveOver(0.5), slot("t2"));

      windowMouse("mouseup", 110, 100);

      expect(tabListService.stackTabs).toHaveBeenCalledExactlyOnceWith("t1", "t2");
      expect(component.stackTarget()).toBeUndefined();
    });

    it("appends the dragged tab to a stack it is released over", () => {
      drag("t1");
      component.dragOver(moveOver(0.5), slot("s1"));

      windowMouse("mouseup", 110, 100);

      expect(tabListService.placeTabInStack).toHaveBeenCalledExactlyOnceWith(
        "t1",
        "s1",
        "t4",
        "after",
      );
    });

    it("forgets the stack to join once the pointer moves on to an edge or leaves", () => {
      drag("t1");
      component.dragOver(moveOver(0.5), slot("t2"));

      component.dragOver(moveOver(0.8), slot("t2"));
      expect(component.stackTarget()).toBeUndefined();

      component.dragOver(moveOver(0.5), slot("t2"));
      component.clearStackTarget();
      expect(component.stackTarget()).toBeUndefined();

      windowMouse("mouseup", 110, 100);
      expect(tabListService.stackTabs).not.toHaveBeenCalled();
    });

    it("gives a member nothing to join over the middle of its own stack's head", () => {
      drag("t3");

      component.dragOver(moveOver(0.5), slot("s1"));

      expect(component.stackTarget()).toBeUndefined();
    });

    it("puts the dragged tab before or after a segment by its half", () => {
      drag("t1");

      component.dragOver(moveOver(0.3), segment("t3", "s1"));
      component.dragOver(moveOver(0.7), segment("t4", "s1"));

      expect(tabListService.placeTabInStack).toHaveBeenNthCalledWith(1, "t1", "s1", "t3", "before");
      expect(tabListService.placeTabInStack).toHaveBeenNthCalledWith(2, "t1", "s1", "t4", "after");
      expect(component.stackTarget()).toBeUndefined();
    });

    it("only reorders a dragged stack, by the half of the slot, and never into a stack", () => {
      drag("s1", "stack");

      component.dragOver(moveOver(0.4), slot("t1"));
      component.dragOver(moveOver(0.6), slot("t2"));
      component.dragOver(moveOver(0.3), segment("t3", "s1"));

      expect(tabListService.placeSlot).toHaveBeenNthCalledWith(1, "s1", "t1", "before");
      expect(tabListService.placeSlot).toHaveBeenNthCalledWith(2, "s1", "t2", "after");
      expect(tabListService.placeTabInStack).not.toHaveBeenCalled();
      expect(component.stackTarget()).toBeUndefined();
    });

    it("does nothing without a drag, without a pressed button, or over the dragged slot", () => {
      component.dragOver(moveOver(0.1), slot("t2"));

      drag("t1");
      component.dragOver(moveOver(0.1, 0), slot("t2"));
      component.dragOver(moveOver(0.5), slot("t2"));
      component.dragOver(moveOver(0.5), slot("t1"));

      expect(tabListService.placeSlot).not.toHaveBeenCalled();
      expect(component.stackTarget()).toBeUndefined();
    });
  });

  it("removes its listeners and the preview when destroyed mid-drag", () => {
    drag("t1");
    dragPreview.updateDragPreviewPosition.mockClear();

    component.ngOnDestroy();
    windowMouse("mousemove", 200, 200);

    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });

  it("leaves no window listener behind after a release or a destroy", () => {
    const activeWindowListeners = trackWindowListeners();

    component.startSlotDrag(mouseDown(), "t1", "tab");
    expect(activeWindowListeners()).toBe(2);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(activeWindowListeners()).toBe(0);

    component.startSlotDrag(mouseDown(), "t1", "tab");
    component.ngOnDestroy();
    expect(activeWindowListeners()).toBe(0);
  });
});
