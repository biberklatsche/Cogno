import { InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TerminalFullscreenService } from "@cogno/core/workbench/terminal/terminal-fullscreen.service";
import { DragPreviewService } from "@cogno/shared/ui";
import { Observable, of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { PaneHeaderComponent } from "./pane-header.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const headerRectangle = { width: 300, height: 20 } as DOMRect;

function mouseDown(overrides: Partial<{ button: number; clientX: number; clientY: number }> = {}) {
  const currentTarget = document.createElement("div");
  vi.spyOn(currentTarget, "getBoundingClientRect").mockReturnValue(headerRectangle);
  return {
    button: 0,
    clientX: 100,
    clientY: 100,
    target: currentTarget,
    currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
  };
}

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
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
 * Pins the press / threshold / drag / drop behaviour of the pane header before
 * the drag state machine is shared with the tab strip and the workspace panel.
 */
describe("PaneHeaderComponent drag interaction", () => {
  let component: PaneHeaderComponent;
  let swapDragActive: boolean;
  let elementUnderPointer: Element | null;
  let gridListService: {
    activeGridIsSplit$: Observable<boolean>;
    startPaneSwapDrag: ReturnType<typeof vi.fn>;
    finishPaneSwapDrag: ReturnType<typeof vi.fn>;
    cancelPaneSwapDrag: ReturnType<typeof vi.fn>;
    movePaneSwapSourceToNewTab: ReturnType<typeof vi.fn>;
    isPaneSwapDragActive: ReturnType<typeof vi.fn>;
    focusActiveTerminal: ReturnType<typeof vi.fn>;
  };
  let dragPreview: {
    startDragPreview: ReturnType<typeof vi.fn>;
    updateDragPreviewPosition: ReturnType<typeof vi.fn>;
    stopDragPreview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    swapDragActive = false;
    elementUnderPointer = null;
    gridListService = {
      activeGridIsSplit$: of(false),
      startPaneSwapDrag: vi.fn(() => {
        swapDragActive = true;
      }),
      finishPaneSwapDrag: vi.fn(() => {
        swapDragActive = false;
      }),
      cancelPaneSwapDrag: vi.fn(() => {
        swapDragActive = false;
      }),
      movePaneSwapSourceToNewTab: vi.fn(() => {
        swapDragActive = false;
      }),
      isPaneSwapDragActive: vi.fn(() => swapDragActive),
      focusActiveTerminal: vi.fn(),
    };
    dragPreview = {
      startDragPreview: vi.fn(),
      updateDragPreviewPosition: vi.fn(),
      stopDragPreview: vi.fn(),
    };
    // happy-dom has no layout, so elementFromPoint is stubbed on the real document.
    document.elementFromPoint = vi.fn(() => elementUnderPointer);

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(() => {
      const created = new PaneHeaderComponent(
        gridListService as unknown as GridListService,
        { isTerminalFullScreen: () => false } as unknown as TerminalFullscreenService,
        dragPreview as unknown as DragPreviewService,
        { forTerminal$: () => of([]) } as unknown as BusyIndicatorService,
        document,
      );
      setInput(created.title, "zsh");
      setInput(created.terminalId, "term-1");
      return created;
    });
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it("starts the pane swap on press and keeps terminal focus", () => {
    const event = mouseDown();

    component.startPaneSwapDrag(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(gridListService.startPaneSwapDrag).toHaveBeenCalledExactlyOnceWith("term-1");
    expect(gridListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
  });

  it("shows no preview below the 4px threshold", () => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mousemove", 103, 97);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });

  it.each([
    ["horizontally", 104, 100],
    ["vertically", 100, 96],
  ])("shows the preview once the pointer moved 4px %s", (_axis, clientX, clientY) => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mousemove", clientX, clientY);

    expect(dragPreview.startDragPreview).toHaveBeenCalledExactlyOnceWith(
      headerRectangle,
      clientX,
      clientY,
    );
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenCalledWith(clientX, clientY);
  });

  it("only moves the preview on further pointer moves", () => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mousemove", 110, 100);
    windowMouse("mousemove", 150, 120);

    expect(dragPreview.startDragPreview).toHaveBeenCalledTimes(1);
    expect(dragPreview.updateDragPreviewPosition).toHaveBeenLastCalledWith(150, 120);
  });

  it("finishes the swap on release, even without having moved", () => {
    component.startPaneSwapDrag(mouseDown());
    gridListService.focusActiveTerminal.mockClear();

    windowMouse("mouseup", 100, 100);

    expect(gridListService.finishPaneSwapDrag).toHaveBeenCalledTimes(1);
    expect(gridListService.movePaneSwapSourceToNewTab).not.toHaveBeenCalled();
    expect(gridListService.focusActiveTerminal).toHaveBeenCalledTimes(1);
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("moves the pane to a new tab when released over the tab list", () => {
    const tabList = document.createElement("app-tab-list");
    elementUnderPointer = tabList.appendChild(document.createElement("div"));

    component.startPaneSwapDrag(mouseDown());
    windowMouse("mousemove", 110, 100);
    windowMouse("mouseup", 110, 5);

    expect(document.elementFromPoint).toHaveBeenCalledWith(110, 5);
    expect(gridListService.movePaneSwapSourceToNewTab).toHaveBeenCalledTimes(1);
    expect(gridListService.finishPaneSwapDrag).not.toHaveBeenCalled();
  });

  it("cancels the swap when another button is released", () => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mouseup", 100, 100, 2);

    expect(gridListService.cancelPaneSwapDrag).toHaveBeenCalledTimes(1);
    expect(gridListService.finishPaneSwapDrag).not.toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
  });

  it("stops listening after the release", () => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mouseup", 100, 100);
    gridListService.cancelPaneSwapDrag.mockClear();

    windowMouse("mousemove", 200, 200);
    windowMouse("mouseup", 200, 200);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
    expect(gridListService.finishPaneSwapDrag).toHaveBeenCalledTimes(1);
    expect(gridListService.cancelPaneSwapDrag).not.toHaveBeenCalled();
  });

  it("shows no preview when the swap was cancelled elsewhere in the meantime", () => {
    component.startPaneSwapDrag(mouseDown());
    swapDragActive = false;

    windowMouse("mousemove", 200, 200);

    expect(dragPreview.startDragPreview).not.toHaveBeenCalled();
  });

  it("ignores a press with another button", () => {
    const event = mouseDown({ button: 2 });

    component.startPaneSwapDrag(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(gridListService.startPaneSwapDrag).not.toHaveBeenCalled();
  });

  it("cancels the swap and removes listeners and preview when destroyed mid-drag", () => {
    component.startPaneSwapDrag(mouseDown());
    windowMouse("mousemove", 110, 100);
    dragPreview.updateDragPreviewPosition.mockClear();

    component.ngOnDestroy();
    swapDragActive = true;
    windowMouse("mousemove", 200, 200);

    expect(gridListService.cancelPaneSwapDrag).toHaveBeenCalled();
    expect(dragPreview.stopDragPreview).toHaveBeenCalled();
    expect(dragPreview.updateDragPreviewPosition).not.toHaveBeenCalled();
  });
  it("leaves no window listener behind after a release or a destroy", () => {
    const activeWindowListeners = trackWindowListeners();

    component.startPaneSwapDrag(mouseDown());
    expect(activeWindowListeners()).toBe(2);
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    expect(activeWindowListeners()).toBe(0);

    component.startPaneSwapDrag(mouseDown());
    component.ngOnDestroy();
    expect(activeWindowListeners()).toBe(0);
  });
});
