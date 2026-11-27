import { InputSignal, provideZonelessChangeDetection } from "@angular/core";
import { SIGNAL } from "@angular/core/primitives/signals";
import { TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { DragPreviewService } from "@cogno/core/workbench/drag-preview/drag-preview.service";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { BehaviorSubject, Observable, of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaneHeaderComponent } from "./pane-header.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/** The specs run JIT without the compiler, so a signal input is fed through its node. */
function setInput<T>(input: InputSignal<T>, value: T): void {
  const node = input[SIGNAL];
  node.applyValueToInputSignal(node, value);
}

describe("PaneHeaderComponent maximize button", () => {
  let component: PaneHeaderComponent;
  let maximizedTerminalId: BehaviorSubject<string | undefined>;
  let gridListService: {
    activeGridIsSplit$: Observable<boolean>;
    maximizedTerminalId$: BehaviorSubject<string | undefined>;
    togglePaneMaximize: ReturnType<typeof vi.fn>;
    deferFocusTo: ReturnType<typeof vi.fn>;
    cancelPaneSwapDrag: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    maximizedTerminalId = new BehaviorSubject<string | undefined>(undefined);
    gridListService = {
      activeGridIsSplit$: of(true),
      maximizedTerminalId$: maximizedTerminalId,
      togglePaneMaximize: vi.fn(),
      deferFocusTo: vi.fn(),
      cancelPaneSwapDrag: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    component = TestBed.runInInjectionContext(() => {
      const created = new PaneHeaderComponent(
        gridListService as unknown as GridListService,
        { stopDragPreview: vi.fn() } as unknown as DragPreviewService,
        { forTerminal$: () => of([]) } as unknown as BusyIndicatorService,
        document,
      );
      setInput(created.title, "zsh");
      setInput(created.terminalId, "term-1");
      return created;
    });
  });

  it("toggles this pane and gives it the keyboard", () => {
    component.toggleMaximize();

    expect(gridListService.togglePaneMaximize).toHaveBeenCalledWith("term-1");
    expect(gridListService.deferFocusTo).toHaveBeenCalledWith("term-1");
  });

  it("knows whether this pane is the maximized one", () => {
    expect(component.isMaximized()).toBe(false);

    maximizedTerminalId.next("term-1");
    expect(component.isMaximized()).toBe(true);

    maximizedTerminalId.next("term-2");
    expect(component.isMaximized()).toBe(false);
  });
});
