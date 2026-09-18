import { provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { defaultWorkspaceIdContract } from "@cogno/shared/domain";
import { DragPreviewService } from "@cogno/shared/ui";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  getActionKeybindingPortMock,
  getConfigService,
  getDestroyRef,
} from "../../../__test__/test-factory";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceSideComponent } from "./workspace-side.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const tileRectangle = { width: 200, height: 60 } as DOMRect;

function mouseDown(
  overrides: Partial<{
    button: number;
    clientX: number;
    clientY: number;
    target: EventTarget;
  }> = {},
): MouseEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  const currentTarget = document.createElement("div");
  vi.spyOn(currentTarget, "getBoundingClientRect").mockReturnValue(tileRectangle);
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

function click(): MouseEvent & {
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
} {
  return { preventDefault: vi.fn(), stopPropagation: vi.fn() } as never;
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
 * Pins the press / threshold / drag / drop behaviour of the workspace tiles
 * before the drag state machine is shared with the tab strip and the pane header.
 */
describe("WorkspaceSideComponent drag interaction", () => {
  let component: WorkspaceSideComponent;
  let workspaceService: {
    workspaceEntries: ReturnType<typeof signal>;
    registerNavigationItemsProvider: ReturnType<typeof vi.fn>;
    unregisterNavigationItemsProvider: ReturnType<typeof vi.fn>;
    reorderWorkspaces: ReturnType<typeof vi.fn>;
    persistWorkspaceOrder: ReturnType<typeof vi.fn>;
    restoreWorkspace: ReturnType<typeof vi.fn>;
  };
  let dragPreview: {
    startDragPreview: ReturnType<typeof vi.fn>;
    updateDragPreviewPosition: ReturnType<typeof vi.fn>;
    stopDragPreview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    workspaceService = {
      workspaceEntries: signal([]),
      registerNavigationItemsProvider: vi.fn(),
      unregisterNavigationItemsProvider: vi.fn(),
      reorderWorkspaces: vi.fn().mockResolvedValue(undefined),
      persistWorkspaceOrder: vi.fn().mockResolvedValue(undefined),
      restoreWorkspace: vi.fn().mockResolvedValue(undefined),
    };
    dragPreview = {
      startDragPreview: vi.fn(),
      updateDragPreviewPosition: vi.fn(),
      stopDragPreview: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(
      () =>
        new WorkspaceSideComponent(
          workspaceService as unknown as WorkspaceService,
          dragPreview as unknown as DragPreviewService,
          getActionKeybindingPortMock(),
          getConfigService(),
          getDestroyRef(),
        ),
    );
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it("prevents the default on press", () => {
    const event = mouseDown();

    component.startWorkspaceReorderInteraction(event, "ws-1");

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("does not start a drag below the 4px threshold, and a plain release persists nothing", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", 103, 97);
    windowMouse("mouseup", 103, 97);

    expect(component.isDraggingWorkspace).toBe(false);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(workspaceService.persistWorkspaceOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["horizontally", 104, 100],
    ["vertically", 100, 96],
  ])("starts the drag once the pointer moved 4px %s", (_axis, clientX, clientY) => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", clientX, clientY);

    expect(component.isDraggingWorkspace).toBe(true);
    expect(component.draggedWorkspaceIdentifier).toBe("ws-1");
    expect(dragPreview.startDragPreview).toHaveBeenCalledExactlyOnceWith(
      tileRectangle,
      clientX,
      clientY,
    );
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenCalledWith(clientX, clientY);
  });

  it("only moves the preview on further pointer moves", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", 110, 100);
    windowMouse("mousemove", 150, 120);

    expect(dragPreview.startDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenLastCalledWith(150, 120);
  });

  it("persists the order on drop and ends the drag", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", 110, 100);
    windowMouse("mouseup", 110, 100);

    expect(workspaceService.persistWorkspaceOrder).toHaveBeenCalledTimes(1);
    expect(component.isDraggingWorkspace).toBe(false);
    expect(component.draggedWorkspaceIdentifier).toBeUndefined();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("swallows the click that follows a drop, once", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", 110, 100);
    windowMouse("mouseup", 110, 100);

    const clickAfterDrop = click();
    component.onWorkspaceClick("ws-1", clickAfterDrop);
    expect(clickAfterDrop.preventDefault).toHaveBeenCalled();
    expect(clickAfterDrop.stopPropagation).toHaveBeenCalled();
    expect(workspaceService.restoreWorkspace).not.toHaveBeenCalled();

    component.onWorkspaceClick("ws-1", click());
    expect(workspaceService.restoreWorkspace).toHaveBeenCalledExactlyOnceWith("ws-1");
  });

  it("does not swallow a click after a press without a drag", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mouseup", 100, 100);

    component.onWorkspaceClick("ws-1", click());

    expect(workspaceService.restoreWorkspace).toHaveBeenCalledExactlyOnceWith("ws-1");
  });

  it("stops listening after the release", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mouseup", 100, 100);

    windowMouse("mousemove", 200, 200);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });

  it("neither persists nor keeps listening when another button is released", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mouseup", 100, 100, 2);

    expect(workspaceService.persistWorkspaceOrder).not.toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();

    windowMouse("mousemove", 200, 200);
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press with another button", () => {
    const event = mouseDown({ button: 2 });

    component.startWorkspaceReorderInteraction(event, "ws-1");
    windowMouse("mousemove", 200, 200);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("never drags the default workspace", () => {
    const event = mouseDown();

    component.startWorkspaceReorderInteraction(event, defaultWorkspaceIdContract);
    windowMouse("mousemove", 200, 200);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it.each([
    ["a button", "button", ""],
    ["the close button", "span", "workspace-close-button"],
    ["the actions", "div", "workspace-actions"],
    ["copy/edit/delete", "app-copy-edit-delete", ""],
  ])("ignores a press inside %s", (_name, tagName, className) => {
    const control = document.createElement(tagName);
    control.className = className;
    const inner = document.createElement("i");
    control.appendChild(inner);
    const event = mouseDown({ target: inner });

    component.startWorkspaceReorderInteraction(event, "ws-1");
    windowMouse("mousemove", 200, 200);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  describe("reorderWhileDragging", () => {
    const entering = (buttons: number) => ({ buttons }) as MouseEvent;

    it("reorders when the dragged workspace enters another one", () => {
      component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
      windowMouse("mousemove", 110, 100);

      component.reorderWhileDragging("ws-2", entering(1));

      expect(workspaceService.reorderWorkspaces).toHaveBeenCalledExactlyOnceWith("ws-1", "ws-2");
    });

    it("does nothing without a drag, without a pressed button, over itself or over the default workspace", () => {
      component.reorderWhileDragging("ws-2", entering(1));

      component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
      windowMouse("mousemove", 110, 100);
      component.reorderWhileDragging("ws-2", entering(0));
      component.reorderWhileDragging("ws-1", entering(1));
      component.reorderWhileDragging(defaultWorkspaceIdContract, entering(1));

      expect(workspaceService.reorderWorkspaces).not.toHaveBeenCalled();
    });
  });

  it("removes its listeners and the preview when destroyed mid-drag", () => {
    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    windowMouse("mousemove", 110, 100);
    dragPreview.updateDragPreviewPosition.mockClear();

    component.ngOnDestroy();
    windowMouse("mousemove", 200, 200);

    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });
  it("leaves no window listener behind after a release or a destroy", () => {
    const activeWindowListeners = trackWindowListeners();

    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    expect(activeWindowListeners()).toBe(2);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(activeWindowListeners()).toBe(0);

    component.startWorkspaceReorderInteraction(mouseDown(), "ws-1");
    component.ngOnDestroy();
    expect(activeWindowListeners()).toBe(0);
  });
});
