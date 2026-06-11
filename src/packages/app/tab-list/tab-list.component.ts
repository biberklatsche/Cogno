import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  effect,
  OnDestroy,
  Signal,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { TabId } from "@cogno/core-api";
import {
  ContextMenuItem,
  ContextMenuOverlayService,
  DragPreviewService,
  Icon,
  IconComponent,
  TooltipDirective,
} from "@cogno/core-ui";
import { map, Observable, Subscription } from "rxjs";
import { BusyIndicatorComponent } from "../common/busy-indicator/busy-indicator.component";
import { BusyIndicatorService } from "../common/busy-indicator/busy-indicator.service";
import { ColorName } from "../common/color/color";
import { ColorSelectComponent } from "../common/color/color-select.component";
import { IdCreator } from "../common/id-creator/id-creator";
import { StartEllipsisDirective } from "../common/text/start-ellipsis.directive";
import { ShellType } from "../config/+models/config";
import { ActionKeybindingPipe } from "../keybinding/pipe/keybinding.pipe";
import { AppMenuButtonComponent } from "../menu/app-menu/app-menu-button.component";
import { Tab } from "./+model/tab";
import { TabListService } from "./+state/tab-list.service";

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
  private static readonly minimumDragStartDistanceInPixels = 4;

  private readonly tabAnimationCountCache = new Map<TabId, Observable<number>>();
  private readonly tabCacheCleanupSub: Subscription;

  tabs: Observable<Tab[]>;
  readonly showRename: Signal<TabId | undefined>;
  isDraggingTab = false;
  draggedTabIdentifier: TabId | undefined;

  private mouseDownTabIdentifier: TabId | undefined;
  private mouseDownClientX = 0;
  private mouseDownClientY = 0;
  private mouseDownTabRectangle: DOMRect | undefined;

  private readonly handleWindowMouseMove = (event: MouseEvent): void =>
    this.onWindowMouseMove(event);
  private readonly handleWindowMouseUp = (event: MouseEvent): void => this.onWindowMouseUp(event);
  @ViewChild("renameInput") inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild("colorPickerItem") colorPickerItemTpl!: TemplateRef<{ $implicit: ContextMenuItem }>;

  private contextMenuTabId?: TabId;

  constructor(
    private tabListService: TabListService,
    private menu: ContextMenuOverlayService,
    private dragPreviewService: DragPreviewService,
    readonly busyIndicatorService: BusyIndicatorService,
  ) {
    this.tabs = this.tabListService.tabs$;
    this.showRename = this.tabListService.showRename$;

    this.tabCacheCleanupSub = this.tabListService.tabs$.subscribe((tabs) => {
      const currentIds = new Set(tabs.map((t) => t.id));
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
    this.tabCacheCleanupSub.unsubscribe();
    this.removeWindowPointerListeners();
    this.dragPreviewService.stopDragPreview();
  }

  closeTab(tabId: TabId): void {
    this.tabListService.removeTab(tabId);
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
    this.isDraggingTab = false;
    this.draggedTabIdentifier = undefined;
    this.mouseDownTabIdentifier = tabId;
    this.mouseDownClientX = event.clientX;
    this.mouseDownClientY = event.clientY;
    const currentTargetElement = event.currentTarget;
    this.mouseDownTabRectangle =
      currentTargetElement instanceof HTMLElement
        ? currentTargetElement.getBoundingClientRect()
        : undefined;
    this.tabListService.focusActiveTerminal();
    this.addWindowPointerListeners();
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
    this.contextMenuTabId = tabId;
    const items: ContextMenuItem[] = this.tabListService.buildContextMenu(tabId);
    this.menu.openAtElement(event.currentTarget as HTMLElement, {
      items,
      customItemTemplate: this.colorPickerItemTpl,
    });
  }

  onTabColorPick(color: ColorName | undefined) {
    if (this.contextMenuTabId) {
      this.tabListService.setColor(this.contextMenuTabId, color);
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

  private onWindowMouseMove(event: MouseEvent): void {
    if (this.isDraggingTab) {
      this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
      return;
    }
    if (!this.mouseDownTabIdentifier) return;
    const horizontalDistanceInPixels = Math.abs(event.clientX - this.mouseDownClientX);
    const verticalDistanceInPixels = Math.abs(event.clientY - this.mouseDownClientY);
    if (
      horizontalDistanceInPixels < TabListComponent.minimumDragStartDistanceInPixels &&
      verticalDistanceInPixels < TabListComponent.minimumDragStartDistanceInPixels
    ) {
      return;
    }

    this.isDraggingTab = true;
    this.draggedTabIdentifier = this.mouseDownTabIdentifier;
    if (this.mouseDownTabRectangle) {
      this.dragPreviewService.startDragPreview(
        this.mouseDownTabRectangle,
        event.clientX,
        event.clientY,
      );
    }
    this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
  }

  private onWindowMouseUp(event: MouseEvent): void {
    if (event.button !== 0) {
      this.mouseDownTabIdentifier = undefined;
      this.mouseDownTabRectangle = undefined;
      this.removeWindowPointerListeners();
      this.dragPreviewService.stopDragPreview();
      return;
    }

    const mouseDownTabIdentifier = this.mouseDownTabIdentifier;
    if (this.isDraggingTab) {
      this.isDraggingTab = false;
      this.draggedTabIdentifier = undefined;
      this.tabListService.focusActiveTerminal();
    } else if (mouseDownTabIdentifier) {
      this.tabListService.selectTab(mouseDownTabIdentifier);
      this.tabListService.focusActiveTerminal();
    }
    this.mouseDownTabIdentifier = undefined;
    this.mouseDownTabRectangle = undefined;
    this.removeWindowPointerListeners();
    this.dragPreviewService.stopDragPreview();
  }

  private addWindowPointerListeners(): void {
    window.addEventListener("mousemove", this.handleWindowMouseMove, true);
    window.addEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private removeWindowPointerListeners(): void {
    window.removeEventListener("mousemove", this.handleWindowMouseMove, true);
    window.removeEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private isInsideNonDraggableTabControl(eventTarget: EventTarget | null): boolean {
    if (!(eventTarget instanceof HTMLElement)) return false;
    return !!eventTarget.closest(".close, .inline-input");
  }
}
