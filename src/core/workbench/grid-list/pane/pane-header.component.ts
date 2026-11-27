import { DOCUMENT } from "@angular/common";
import { Component, computed, Inject, input, OnDestroy } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActionKeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/action-keybinding.pipe";
import { BusyIndicatorComponent } from "@cogno/core/workbench/busy-indicator/busy-indicator.component";
import { BusyIndicatorService } from "@cogno/core/workbench/busy-indicator/busy-indicator.service";
import { DragPreviewService } from "@cogno/core/workbench/drag-preview/drag-preview.service";
import { trackPointerDrag } from "@cogno/core/workbench/drag-preview/pointer-drag";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { switchMap } from "rxjs";
import { GridListService } from "../+state/grid-list.service";

@Component({
  selector: "app-pane-header",
  standalone: true,
  imports: [IconComponent, BusyIndicatorComponent, TooltipDirective, ActionKeybindingPipe],
  template: `
    @if (shouldShow()) {
      <div class="pane-header" (mousedown)="startPaneSwapDrag($event)">
        @if (hasBusyRegistrations()) {
          <span class="busy-indicator">
            <app-busy-indicator targetKind="terminal" [targetId]="terminalId()"></app-busy-indicator>
          </span>
        }
        <span class="title">{{ title() }}</span>
        <div class="buttons">
          <button class="button icon-button" type="button" [class.maximized]="isMaximized()"
                  (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation(); toggleMaximize()"
                  [appTooltip]="isMaximized() ? 'Restore pane' : 'Maximize pane'"
                  [appTooltipSecondary]="(isMaximized() ? 'minimize_pane' : 'maximize_pane') | actionkeybinding">
            <app-icon [name]="isMaximized() ? 'mdiArrowCollapse' : 'mdiArrowExpand'"></app-icon>
          </button>
          <button class="button icon-button" type="button" (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation(); closePane()">
            <app-icon name="mdiClose"></app-icon>
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .pane-header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Room for the absolutely positioned busy indicator and buttons, the
         same on both sides so the title stays centred. */
      padding: 2px 48px;
      background: transparent;
      height: 24px;
    }

    .title {
      font-family: var(--font-family);
      font-size: calc(var(--font-size) * 0.9);
      color: var(--foreground-color);
      opacity: 0.7;
      text-align: center;
      /* Programs set the title via OSC; a long one must not wrap over the terminal. */
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .busy-indicator {
      position: absolute;
      left: 8px;
      top: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 12px;
      pointer-events: none;
      color: color-mix(in srgb, var(--foreground-color) 60%, transparent);
      transform: translateY(-50%);
    }

    .buttons {
      position: absolute;
      right: 2px;
      display: flex;
      gap: 2px;
    }

    /* The side panels' header buttons have the same size and, both being the
       theme's icon button, the same colours (side-menu.component). */
    .button.icon-button {
      width: 20px;
      height: 20px;
      padding: 2px;
      cursor: default;

      /* The way back from a maximized pane stays in sight. */
      &.maximized {
        color: var(--foreground-color);
      }
    }
  `,
})
export class PaneHeaderComponent implements OnDestroy {
  private stopPointerDrag: (() => void) | undefined;

  title = input.required<string>();
  terminalId = input.required<string>();

  /**
   * A pane of a split grid has its header, also while a full-screen program
   * runs in it: it is the only place to close or maximize the pane with the
   * mouse, and a header that comes and goes would resize the program.
   */
  readonly shouldShow = toSignal(this.gridListService.activeGridIsSplit$, {
    initialValue: false,
  });
  private readonly maximizedTerminalId = toSignal(this.gridListService.maximizedTerminalId$, {
    initialValue: undefined,
  });
  readonly isMaximized = computed(() => this.maximizedTerminalId() === this.terminalId());

  private readonly busyRegistrations = toSignal(
    toObservable(this.terminalId).pipe(
      switchMap((id) => this.busyIndicatorService.forTerminal$(id)),
    ),
    { initialValue: [] },
  );
  readonly hasBusyRegistrations = computed(() => this.busyRegistrations().length > 0);

  constructor(
    private gridListService: GridListService,
    private dragPreviewService: DragPreviewService,
    private readonly busyIndicatorService: BusyIndicatorService,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnDestroy(): void {
    this.stopPointerDrag?.();
    this.gridListService.cancelPaneSwapDrag();
    this.dragPreviewService.stopDragPreview();
  }

  startPaneSwapDrag(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.gridListService.startPaneSwapDrag(this.terminalId());
    this.gridListService.focusActiveTerminal();
    this.stopPointerDrag?.();
    this.stopPointerDrag = trackPointerDrag(event, this.dragPreviewService, {
      // Another pane closing mid-drag cancels the swap; the pointer is then ignored.
      isActive: () => this.gridListService.isPaneSwapDragActive(),
      onRelease: (releaseEvent) => this.dropPane(releaseEvent),
      onCancel: () => this.gridListService.cancelPaneSwapDrag(),
    });
  }

  /** Maximizes this pane or restores it, and gives it the keyboard either way. */
  toggleMaximize(): void {
    this.gridListService.togglePaneMaximize(this.terminalId());
    this.gridListService.deferFocusTo(this.terminalId());
  }

  closePane() {
    this.gridListService.removePane(this.terminalId());
  }

  private dropPane(event: MouseEvent): void {
    if (!this.gridListService.isPaneSwapDragActive()) {
      this.gridListService.cancelPaneSwapDrag();
      return;
    }
    if (this.isPointerOverTabList(event.clientX, event.clientY)) {
      this.gridListService.movePaneSwapSourceToNewTab();
    } else {
      this.gridListService.finishPaneSwapDrag();
    }
    this.gridListService.focusActiveTerminal();
  }

  private isPointerOverTabList(pointerClientX: number, pointerClientY: number): boolean {
    const elementUnderPointer = this.document.elementFromPoint(pointerClientX, pointerClientY);
    if (!(elementUnderPointer instanceof HTMLElement)) return false;
    return !!elementUnderPointer.closest(".tab-list, app-tab-list");
  }
}
