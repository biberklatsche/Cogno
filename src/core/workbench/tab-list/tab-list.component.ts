import { CommonModule } from "@angular/common";
import {
  AnimationCallbackEvent,
  Component,
  computed,
  ElementRef,
  effect,
  OnDestroy,
  Signal,
  signal,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { ActionKeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/action-keybinding.pipe";
import { AppMenuButtonComponent } from "@cogno/core/workbench/app-menu/app-menu-button.component";
import { BusyIndicatorComponent } from "@cogno/core/workbench/busy-indicator/busy-indicator.component";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { ColorSelectComponent } from "@cogno/core/workbench/color/color-select.component";
import { DragPreviewService } from "@cogno/core/workbench/drag-preview/drag-preview.service";
import { trackPointerDrag } from "@cogno/core/workbench/drag-preview/pointer-drag";
import { StackId, TabId } from "@cogno/core/workbench/grid-layout";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import {
  flatTabs,
  isStack,
  Tab,
  TabList,
  TabStack,
} from "@cogno/core/workbench/tab-list/+model/tab";
import {
  PlacementSide,
  TabListService,
} from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { ColorName } from "@cogno/shared/support";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  Icon,
  IconComponent,
  StartEllipsisDirective,
  TooltipDirective,
} from "@cogno/shared/ui";
import { combineLatest, map, Observable } from "rxjs";

/** What the pointer is over while a slot or a member is dragged. */
export type DragTarget =
  | { kind: "slot"; id: TabId | StackId }
  | { kind: "segment"; id: TabId; stackId: StackId };

/** How busy a stack is and which member's animation stands for it. */
export type StackBusy = { count: number; tabId: TabId | undefined };

/** The share of a slot's width on each side that reorders; the middle stacks. */
const REORDER_EDGE_SHARE = 0.25;

@Component({
  selector: "app-tab-list",
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    AppMenuButtonComponent,
    TooltipDirective,
    ActionKeybindingPipe,
    StartEllipsisDirective,
    BusyIndicatorComponent,
    ColorSelectComponent,
  ],
  templateUrl: "./tab-list.component.html",
  styleUrl: "./tab-list.component.scss",
})
export class TabListComponent implements OnDestroy {
  /** Slightly above the 100ms slide-out animation in tab-list.component.scss. */
  private static readonly tabLeaveAnimationFallbackMs = 150;

  private readonly animationCountCache = new Map<string, Observable<number>>();
  private readonly stackBusyCache = new Map<string, Observable<StackBusy>>();

  readonly slots: Signal<TabList>;
  readonly showRename: Signal<TabId | StackId | undefined>;
  /** The slot or member under the pointer since the press turned into a drag. */
  readonly dragged = signal<{ id: TabId | StackId; isStack: boolean } | undefined>(undefined);
  /** The tab or stack the dragged tab joins when released over its middle. */
  readonly stackTarget = signal<TabId | StackId | undefined>(undefined);
  readonly isStack = isStack;

  private stopPointerDrag: (() => void) | undefined;
  /** The last placement asked of the service in this drag; the same one is not asked again. */
  private lastPlacement: string | undefined;
  /** Each target's box, read once per drag and placement: a layout flush per pointer move is too dear. */
  private readonly targetRectangles = new Map<string, DOMRect>();
  @ViewChild("renameInput") inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild("colorPickerItem") colorPickerItemTpl!: TemplateRef<{ $implicit: ContextMenuItem }>;

  /** The tab or stack whose context menu is open; the colour picker in it works on this one. */
  private readonly contextMenuTarget = signal<
    { kind: "tab"; id: TabId } | { kind: "stack"; id: StackId } | undefined
  >(undefined);
  readonly contextMenuSelectedColor: Signal<ColorName | undefined>;

  constructor(
    private tabListService: TabListService,
    private menu: ContextMenuOverlayService,
    private dragPreviewService: DragPreviewService,
    readonly busyIndicatorService: BusyIndicatorService,
  ) {
    this.slots = toSignal(this.tabListService.slots$, { initialValue: [] });
    this.showRename = this.tabListService.showRename$;
    this.contextMenuSelectedColor = computed(() => {
      const target = this.contextMenuTarget();
      if (!target) return undefined;
      return target.kind === "tab"
        ? flatTabs(this.slots()).find((tab) => tab.id === target.id)?.color
        : this.slots().find((slot) => slot.id === target.id && isStack(slot))?.color;
    });

    effect(() => {
      const slots = this.slots();
      const currentKeys = new Set<string>([
        ...flatTabs(slots).map((tab) => tab.id),
        ...slots.filter(isStack).map((stack) => this.stackAnimationKey(stack)),
      ]);
      for (const key of this.animationCountCache.keys()) {
        if (!currentKeys.has(key)) this.animationCountCache.delete(key);
      }
      for (const key of this.stackBusyCache.keys()) {
        if (!currentKeys.has(key)) this.stackBusyCache.delete(key);
      }
    });

    // Focus the rename input when it appears
    effect(() => {
      const show = this.showRename();
      if (show) {
        // Wait for the view to render the input before focusing
        queueMicrotask(() => {
          try {
            const el = this.inputRef?.nativeElement;
            if (el) {
              el.focus();
              el.select();
            }
          } catch {
            // ignore if element is not yet available
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPointerDrag?.();
    this.dragPreviewService.stopDragPreview();
  }

  closeTab(tabId: TabId): void {
    this.tabListService.removeTab(tabId);
  }

  toggleStack(event: MouseEvent, stackId: StackId): void {
    event.stopPropagation();
    this.tabListService.toggleStack(stackId);
  }

  colorVariable(color: ColorName | undefined): string | undefined {
    return color ? `var(--color-${color})` : undefined;
  }

  containsActiveTab(stack: TabStack): boolean {
    return stack.tabs.some((tab) => tab.isActive);
  }

  /**
   * Runs the leave animation with a guaranteed completion. The class-based
   * `[animate.leave]` waits for `animationend`, which never fires when the
   * tab strip is not being painted (minimized window, background workspace) —
   * the removed tab would then stay in the DOM forever as an inert ghost.
   */
  animateTabLeave(event: AnimationCallbackEvent): void {
    const element = event.target as HTMLElement;
    element.classList.add("animate-tab-leave");
    let completed = false;
    const complete = (): void => {
      if (completed) return;
      completed = true;
      event.animationComplete();
    };
    element.addEventListener("animationend", complete, { once: true });
    setTimeout(complete, TabListComponent.tabLeaveAnimationFallbackMs);
  }

  iconForShell(shell: ShellType | "unknown"): Icon {
    switch (shell) {
      case "PowerShell":
        return "mdiPowershell";
      default:
        return "mdiConsole";
    }
  }

  getTabAnimationCount$(tabId: TabId): Observable<number> {
    let obs = this.animationCountCache.get(tabId);
    if (!obs) {
      obs = this.busyIndicatorService
        .forTab$(tabId)
        .pipe(map((regs) => new Set(regs.map((r) => r.terminalId)).size));
      this.animationCountCache.set(tabId, obs);
    }
    return obs;
  }

  /**
   * The members' counts added up, and the member whose animation the head
   * plays: the current one while it is busy, else the first busy one - so a
   * busy member shows on the collapsed head even when another one is in front.
   */
  getStackBusy$(stack: TabStack): Observable<StackBusy> {
    const key = this.stackAnimationKey(stack);
    let obs = this.stackBusyCache.get(key);
    if (!obs) {
      obs = combineLatest(stack.tabs.map((tab) => this.getTabAnimationCount$(tab.id))).pipe(
        map((counts) => {
          const busyTabIds = stack.tabs.filter((_tab, index) => counts[index] > 0);
          const shown = busyTabIds.find((tab) => tab.id === stack.currentTabId) ?? busyTabIds[0];
          return { count: counts.reduce((sum, count) => sum + count, 0), tabId: shown?.id };
        }),
      );
      this.stackBusyCache.set(key, obs);
    }
    return obs;
  }

  addTab() {
    this.tabListService.addTab({
      id: IdCreator.newTabId(),
      systemTitle: "Shell",
      activeShellType: "unknown",
      isActive: true,
    });
  }

  /**
   * A press on a tab, a stack head or a segment. Released in place it is a
   * click: a tab is selected, a stack head brings its current member to the
   * front. Moved past the threshold it drags the slot or member; see
   * `dragOver` for what happens on the way.
   */
  startSlotDrag(event: MouseEvent, id: TabId | StackId, kind: "tab" | "stack"): void {
    if (event.button !== 0 || this.showRename() === id) return;
    if (this.isInsideNonDraggableTabControl(event.target)) return;
    // Keep terminal focus while pressing and dragging a tab.
    event.preventDefault();
    this.endDrag();
    this.tabListService.focusActiveTerminal();
    this.stopPointerDrag?.();
    this.stopPointerDrag = trackPointerDrag(event, this.dragPreviewService, {
      onDragStart: () => this.dragged.set({ id, isStack: kind === "stack" }),
      onRelease: (_event, dragged) => {
        const target = this.stackTarget();
        this.endDrag();
        if (!dragged) {
          if (kind === "stack") this.tabListService.selectStack(id);
          else this.tabListService.selectTab(id);
        } else if (target) {
          this.dropOnStackTarget(id, target);
        }
        this.tabListService.focusActiveTerminal();
      },
      onCancel: () => this.endDrag(),
    });
  }

  private endDrag(): void {
    this.dragged.set(undefined);
    this.stackTarget.set(undefined);
    this.lastPlacement = undefined;
    this.targetRectangles.clear();
  }

  /**
   * The pointer moves over `target` while dragging. The outer quarters of a
   * slot reorder right away, as the strip always did; the middle marks the
   * slot as the stack to join on release. A segment takes the dragged tab in
   * before or after it. A dragged stack only reorders.
   */
  dragOver(event: MouseEvent, target: DragTarget): void {
    const dragged = this.dragged();
    if (!dragged || event.buttons === 0) return;
    if (dragged.id === target.id) {
      this.stackTarget.set(undefined);
      return;
    }
    const rectangle = this.rectangleOf(target, event.currentTarget as HTMLElement);
    const share = rectangle.width > 0 ? (event.clientX - rectangle.left) / rectangle.width : 0.5;
    if (target.kind === "segment") {
      this.stackTarget.set(undefined);
      if (dragged.isStack) return;
      this.place(target, share < 0.5 ? "before" : "after", () =>
        this.tabListService.placeTabInStack(
          dragged.id,
          target.stackId,
          target.id,
          share < 0.5 ? "before" : "after",
        ),
      );
      return;
    }
    if (dragged.isStack) {
      const side = share < 0.5 ? "before" : "after";
      this.place(target, side, () => this.tabListService.placeSlot(dragged.id, target.id, side));
      return;
    }
    if (share < REORDER_EDGE_SHARE) {
      this.stackTarget.set(undefined);
      this.place(target, "before", () =>
        this.tabListService.placeSlot(dragged.id, target.id, "before"),
      );
    } else if (share > 1 - REORDER_EDGE_SHARE) {
      this.stackTarget.set(undefined);
      this.place(target, "after", () =>
        this.tabListService.placeSlot(dragged.id, target.id, "after"),
      );
    } else {
      // A member over the middle of its own stack's head has nothing to join.
      const ownStack = this.tabListService.stackOfTab(dragged.id);
      this.stackTarget.set(ownStack?.id === target.id ? undefined : target.id);
    }
  }

  /**
   * Asks the service once per crossing: pointer moves within the same zone are
   * skipped. A placement moves the slots, so the boxes are read anew after it.
   */
  private place(target: DragTarget, side: PlacementSide, ask: () => void): void {
    const placement = `${target.kind}:${target.id}:${side}`;
    if (this.lastPlacement === placement) return;
    this.lastPlacement = placement;
    this.targetRectangles.clear();
    ask();
  }

  private rectangleOf(target: DragTarget, element: HTMLElement): DOMRect {
    const key = `${target.kind}:${target.id}`;
    let rectangle = this.targetRectangles.get(key);
    if (!rectangle) {
      rectangle = element.getBoundingClientRect();
      this.targetRectangles.set(key, rectangle);
    }
    return rectangle;
  }

  clearStackTarget(): void {
    this.stackTarget.set(undefined);
  }

  private dropOnStackTarget(draggedId: TabId, targetId: TabId | StackId): void {
    const target = this.slots().find((slot) => slot.id === targetId);
    if (!target) return;
    if (isStack(target)) {
      const last = target.tabs[target.tabs.length - 1];
      this.tabListService.placeTabInStack(draggedId, target.id, last.id, "after");
    } else {
      this.tabListService.stackTabs(draggedId, target.id);
    }
  }

  closeTabMiddle(event: MouseEvent, tabId: TabId) {
    if (event.button === 1) {
      this.closeTab(tabId);
    }
  }

  buildContextMenu(event: MouseEvent, tabId: TabId) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuTarget.set({ kind: "tab", id: tabId });
    const items: ContextMenuItem[] = this.tabListService.buildContextMenu(tabId);
    this.menu.openAtElement(event.currentTarget as HTMLElement, {
      items,
      customItemTemplate: this.colorPickerItemTpl,
    });
  }

  buildStackContextMenu(event: MouseEvent, stackId: StackId) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuTarget.set({ kind: "stack", id: stackId });
    const items: ContextMenuItem[] = this.tabListService.buildStackContextMenu(stackId);
    this.menu.openAtElement(event.currentTarget as HTMLElement, {
      items,
      customItemTemplate: this.colorPickerItemTpl,
    });
  }

  onTabColorPick(color: ColorName | undefined) {
    const target = this.contextMenuTarget();
    if (!target) return;
    if (target.kind === "tab") this.tabListService.setColor(target.id, color);
    else this.tabListService.setStackColor(target.id, color);
  }

  closeRename() {
    this.tabListService.closeRename();
  }

  commitRename(value: string) {
    this.tabListService.commitRename(value);
  }

  displayTitle(tab: Tab): string {
    return tab.userTitle ?? tab.systemTitle;
  }

  getTabShortcutActionName(index: number): string {
    return `select_tab_${index + 1}`;
  }

  private stackAnimationKey(stack: TabStack): string {
    return `${stack.id}:${stack.currentTabId}:${stack.tabs.map((tab) => tab.id).join(",")}`;
  }

  private isInsideNonDraggableTabControl(eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof HTMLElement)) return false;
    return !!eventTarget.closest(".close, .inline-input, .stack-chevron");
  }
}
