import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import type { Tab } from "@cogno/core/workbench/tab-list/+model/tab";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { ContextMenuOverlayService, DragPreviewService } from "@cogno/shared/ui";
import { Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { TabListComponent } from "./tab-list.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const tabRectangle = { width: 120, height: 24 } as DOMRect;

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
 * Pins the press / threshold / drag / drop behaviour of the tab strip before the
 * drag state machine is shared with the workspace panel and the pane header.
 */
describe("TabListComponent drag interaction", () => {
  let component: TabListComponent;
  let showRename: ReturnType<typeof vi.fn>;
  let tabListService: {
    tabs$: Observable<Tab[]>;
    showRename$: ReturnType<typeof vi.fn>;
    selectTab: ReturnType<typeof vi.fn>;
    focusActiveTerminal: ReturnType<typeof vi.fn>;
    reorderTabs: ReturnType<typeof vi.fn>;
  };
  let dragPreview: {
    startDragPreview: ReturnType<typeof vi.fn>;
    updateDragPreviewPosition: ReturnType<typeof vi.fn>;
    stopDragPreview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    showRename = vi.fn().mockReturnValue(undefined);
    tabListService = {
      tabs$: of([]),
      showRename$: showRename,
      selectTab: vi.fn(),
      focusActiveTerminal: vi.fn(),
      reorderTabs: vi.fn(),
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

    component.startTabReorderInteraction(event, "t1");

    expect(event.preventDefault).toHaveBeenCalled();
    expect(tabListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
  });

  it("selects the tab when the pointer is released without moving", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).toHaveBeenCalledExactlyOnceWith("t1");
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(component.isDraggingTab).toBe(false);
  });

  it("does not start a drag below the 4px threshold", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mousemove", 103, 97);

    expect(component.isDraggingTab).toBe(false);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();

    windowMouse("mouseup", 103, 97);
    expect(tabListService.selectTab).toHaveBeenCalledExactlyOnceWith("t1");
  });

  it.each([
    ["horizontally", 104, 100],
    ["vertically", 100, 96],
  ])("starts the drag once the pointer moved 4px %s", (_axis, clientX, clientY) => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mousemove", clientX, clientY);

    expect(component.isDraggingTab).toBe(true);
    expect(component.draggedTabIdentifier).toBe("t1");
    expect(dragPreview.startDragPreview).toHaveBeenCalledExactlyOnceWith(
      tabRectangle,
      clientX,
      clientY,
    );
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenCalledWith(clientX, clientY);
  });

  it("only moves the preview on further pointer moves", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mousemove", 110, 100);
    windowMouse("mousemove", 150, 120);

    expect(dragPreview.startDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenLastCalledWith(150, 120);
  });

  it("ends the drag on release without selecting the tab", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mousemove", 110, 100);
    tabListService.focusActiveTerminal.mockClear();

    windowMouse("mouseup", 110, 100);

    expect(component.isDraggingTab).toBe(false);
    expect(component.draggedTabIdentifier).toBeUndefined();
    expect(tabListService.selectTab).not.toHaveBeenCalled();
    expect(tabListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("stops listening after the release", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mouseup", 100, 100);
    dragPreview.updateDragPreviewPosition.mockClear();

    windowMouse("mousemove", 200, 200);
    windowMouse("mouseup", 200, 200);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
    expect(tabListService.selectTab).toHaveBeenCalledTimes(1);
  });

  it("neither selects nor keeps listening when another button is released", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mouseup", 100, 100, 2);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();

    windowMouse("mousemove", 200, 200);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press with another button", () => {
    const event = mouseDown({ button: 2 });

    component.startTabReorderInteraction(event, "t1");
    windowMouse("mousemove", 200, 200);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press on the tab that is being renamed", () => {
    showRename.mockReturnValue("t1");

    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
  });

  it.each([".close", ".inline-input"])("ignores a press inside %s", (selector) => {
    const control = document.createElement("span");
    control.className = selector.slice(1);
    const inner = document.createElement("i");
    control.appendChild(inner);

    component.startTabReorderInteraction(mouseDown({ target: inner }), "t1");
    windowMouse("mouseup", 100, 100);

    expect(tabListService.selectTab).not.toHaveBeenCalled();
  });

  describe("reorderWhileDragging", () => {
    const entering = (buttons: number) => ({ buttons }) as MouseEvent;

    it("reorders when the dragged tab enters another tab", () => {
      component.startTabReorderInteraction(mouseDown(), "t1");
      windowMouse("mousemove", 110, 100);

      component.reorderWhileDragging("t2", entering(1));

      expect(tabListService.reorderTabs).toHaveBeenCalledExactlyOnceWith("t1", "t2");
    });

    it("does nothing without a drag, without a pressed button, or over the dragged tab", () => {
      component.reorderWhileDragging("t2", entering(1));

      component.startTabReorderInteraction(mouseDown(), "t1");
      windowMouse("mousemove", 110, 100);
      component.reorderWhileDragging("t2", entering(0));
      component.reorderWhileDragging("t1", entering(1));

      expect(tabListService.reorderTabs).not.toHaveBeenCalled();
    });
  });

  it("removes its listeners and the preview when destroyed mid-drag", () => {
    component.startTabReorderInteraction(mouseDown(), "t1");
    windowMouse("mousemove", 110, 100);
    dragPreview.updateDragPreviewPosition.mockClear();

    component.ngOnDestroy();
    windowMouse("mousemove", 200, 200);

    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });
  it("leaves no window listener behind after a release or a destroy", () => {
    const activeWindowListeners = trackWindowListeners();

    component.startTabReorderInteraction(mouseDown(), "t1");
    expect(activeWindowListeners()).toBe(2);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(activeWindowListeners()).toBe(0);

    component.startTabReorderInteraction(mouseDown(), "t1");
    component.ngOnDestroy();
    expect(activeWindowListeners()).toBe(0);
  });
});
