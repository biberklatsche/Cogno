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
import { AppMenuButtonComponent } from "@cogno/core/workbench/app-menu/app-menu-button.component";
import { BusyIndicatorComponent } from "@cogno/core/workbench/busy-indicator/busy-indicator.component";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { ColorSelectComponent } from "@cogno/core/workbench/color/color-select.component";
import { Tab } from "@cogno/core/workbench/tab-list/+model/tab";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { TabId } from "@cogno/shared/domain";
import { ColorName, IdCreator } from "@cogno/shared/support";
import {
  ActionKeybindingPipe,
  ContextMenuItem,
  ContextMenuOverlayService,
  DragPreviewService,
  Icon,
  IconComponent,
  StartEllipsisDirective,
  TooltipDirective,
  trackPointerDrag,
} from "@cogno/shared/ui";
import { map, Observable } from "rxjs";

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

  private readonly tabAnimationCountCache = new Map<TabId, Observable<number>>();

  readonly tabs: Signal<Tab[]>;
  readonly showRename: Signal<TabId | undefined>;
  isDraggingTab = false;
  draggedTabIdentifier: TabId | undefined;

  private stopPointerDrag: (() => void) | undefined;
  @ViewChild("renameInput") inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild("colorPickerItem") colorPickerItemTpl!: TemplateRef<{ $implicit: ContextMenuItem }>;

  private readonly contextMenuTabId = signal<TabId | undefined>(undefined);
  readonly contextMenuSelectedColor: Signal<ColorName | undefined>;

  constructor(
    private tabListService: TabListService,
    private menu: ContextMenuOverlayService,
    private dragPreviewService: DragPreviewService,
    readonly busyIndicatorService: BusyIndicatorService,
  ) {
    this.tabs = toSignal(this.tabListService.tabs$, { initialValue: [] });
    this.showRename = this.tabListService.showRename$;
    this.contextMenuSelectedColor = computed(
      () => this.tabs().find((tab) => tab.id === this.contextMenuTabId())?.color,
    );

    effect(() => {
      const currentIds = new Set(this.tabs().map((t) => t.id));
      for (const id of this.tabAnimationCountCache.keys()) {
        if (!currentIds.has(id)) this.tabAnimationCountCache.delete(id);
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

  tabColor(tab: Tab): string | undefined {
    return tab.color ? `var(--color-${tab.color})` : undefined;
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
    let obs = this.tabAnimationCountCache.get(tabId);
    if (!obs) {
      obs = this.busyIndicatorService
        .forTab$(tabId)
        .pipe(
          map(
            (regs) =>
              new Set(regs.filter((r) => r.target.kind === "terminal").map((r) => r.target.id))
                .size,
          ),
        );
      this.tabAnimationCountCache.set(tabId, obs);
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

  startTabReorderInteraction(event: MouseEvent, tabId: TabId): void {
    if (event.button !== 0 || this.showRename() === tabId) return;
    if (this.isInsideNonDraggableTabControl(event.target)) return;
    // Keep terminal focus while pressing and dragging a tab.
    event.preventDefault();
    this.endTabDrag();
    this.tabListService.focusActiveTerminal();
    this.stopPointerDrag?.();
    this.stopPointerDrag = trackPointerDrag(event, this.dragPreviewService, {
      onDragStart: () => {
        this.isDraggingTab = true;
        this.draggedTabIdentifier = tabId;
      },
      onRelease: (_event, dragged) => {
        this.endTabDrag();
        // A press without a drag is a click on the tab.
        if (!dragged) this.tabListService.selectTab(tabId);
        this.tabListService.focusActiveTerminal();
      },
      onCancel: () => this.endTabDrag(),
    });
  }

  private endTabDrag(): void {
    this.isDraggingTab = false;
    this.draggedTabIdentifier = undefined;
  }

  reorderWhileDragging(targetTabIdentifier: TabId, event: MouseEvent): void {
    if (!this.isDraggingTab || event.buttons === 0 || !this.draggedTabIdentifier) return;
    if (this.draggedTabIdentifier === targetTabIdentifier) return;
    this.tabListService.reorderTabs(this.draggedTabIdentifier, targetTabIdentifier);
  }

  closeTabMiddle(event: MouseEvent, tabId: TabId) {
    if (event.button === 1) {
      this.closeTab(tabId);
    }
  }

  buildContextMenu(event: MouseEvent, tabId: TabId) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuTabId.set(tabId);
    const items: ContextMenuItem[] = this.tabListService.buildContextMenu(tabId);
    this.menu.openAtElement(event.currentTarget as HTMLElement, {
      items,
      customItemTemplate: this.colorPickerItemTpl,
    });
  }

  onTabColorPick(color: ColorName | undefined) {
    const tabId = this.contextMenuTabId();
    if (tabId) {
      this.tabListService.setColor(tabId, color);
    }
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

  private isInsideNonDraggableTabControl(eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof HTMLElement)) return false;
    return !!eventTarget.closest(".close, .inline-input");
  }
}
