import { DOCUMENT } from "@angular/common";
import { Component, Inject, input, OnDestroy } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { DragPreviewService, IconComponent } from "@cogno/core-ui";
import { GridListService } from "../+state/grid-list.service";

@Component({
  selector: "app-pane-header",
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (shouldShow()) {
      <div class="pane-header" (mousedown)="startPaneSwapDrag($event)">
        <span class="cwd">{{cwd()}}</span>
        <button class="close" type="button" (mousedown)="$event.stopPropagation()" (click)="$event.stopPropagation(); closePane()">
          <app-icon name="mdiClose"></app-icon>
        </button>
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
      padding: 2px 8px;
      background: transparent;
      height: 24px;

      &:hover .close {
        opacity: 0.5;
      }
      
      &:active {
        cursor: pointer;
      }
    }

    .cwd {
      font-family: var(--font-family);
      font-size: calc(var(--font-size) * 0.9);
      color: var(--foreground-color);
      opacity: 0.7;
      text-align: center;
    }

    .close {
      position: absolute;
      right: 2px;
      padding: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      width: 20px;
      height: 20px;
      cursor: default;
      color: var(--foreground-color);
      background-color: var(--background-color-20l-ct);
      border: none;
      opacity: 0;

      &:hover {
        opacity: 1 !important;
      }
    }
  `,
})
export class PaneHeaderComponent implements OnDestroy {
  private static readonly minimumDragStartDistanceInPixels = 4;

  private readonly handleWindowMouseUp = (event: MouseEvent): void => this.onWindowMouseUp(event);
  private readonly handleWindowMouseMove = (event: MouseEvent): void =>
    this.onWindowMouseMove(event);
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragSourceRectangle: DOMRect | undefined;
  private hasExceededDragThreshold = false;

  cwd = input.required<string>();
  terminalId = input.required<string>();

  shouldShow = toSignal(this.gridListService.activeGridIsSplit$, { initialValue: false });

  constructor(
    private gridListService: GridListService,
    private dragPreviewService: DragPreviewService,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnDestroy(): void {
    this.removeWindowMouseUpListener();
    this.removeWindowMouseMoveListener();
    this.gridListService.cancelPaneSwapDrag();
    this.dragPreviewService.stopDragPreview();
  }

  startPaneSwapDrag(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.hasExceededDragThreshold = false;
    const currentTargetElement = event.currentTarget;
    this.dragSourceRectangle =
      currentTargetElement instanceof HTMLElement
        ? currentTargetElement.getBoundingClientRect()
        : undefined;
    this.gridListService.startPaneSwapDrag(this.terminalId());
    this.gridListService.focusActiveTerminal();
    this.addWindowMouseUpListener();
    this.addWindowMouseMoveListener();
  }

  closePane() {
    this.gridListService.removePane(this.terminalId());
  }

  private onWindowMouseUp(event: MouseEvent): void {
    if (event.button === 0 && this.gridListService.isPaneSwapDragActive()) {
      if (this.isPointerOverTabList(event.clientX, event.clientY)) {
        this.gridListService.movePaneSwapSourceToNewTab();
      } else {
        this.gridListService.finishPaneSwapDrag();
      }
      this.gridListService.focusActiveTerminal();
    } else {
      this.gridListService.cancelPaneSwapDrag();
    }
    this.hasExceededDragThreshold = false;
    this.dragSourceRectangle = undefined;
    this.removeWindowMouseUpListener();
    this.removeWindowMouseMoveListener();
    this.dragPreviewService.stopDragPreview();
  }

  private onWindowMouseMove(event: MouseEvent): void {
    if (!this.gridListService.isPaneSwapDragActive()) return;
    if (!this.hasExceededDragThreshold) {
      const horizontalDistanceInPixels = Math.abs(event.clientX - this.dragStartClientX);
      const verticalDistanceInPixels = Math.abs(event.clientY - this.dragStartClientY);
      this.hasExceededDragThreshold =
        horizontalDistanceInPixels >= PaneHeaderComponent.minimumDragStartDistanceInPixels ||
        verticalDistanceInPixels >= PaneHeaderComponent.minimumDragStartDistanceInPixels;
      if (this.hasExceededDragThreshold && this.dragSourceRectangle) {
        this.dragPreviewService.startDragPreview(
          this.dragSourceRectangle,
          event.clientX,
          event.clientY,
        );
      }
    }
    if (this.hasExceededDragThreshold) {
      this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
    }
  }

  private addWindowMouseUpListener(): void {
    window.addEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private addWindowMouseMoveListener(): void {
    window.addEventListener("mousemove", this.handleWindowMouseMove, true);
  }

  private removeWindowMouseUpListener(): void {
    window.removeEventListener("mouseup", this.handleWindowMouseUp, true);
  }

  private removeWindowMouseMoveListener(): void {
    window.removeEventListener("mousemove", this.handleWindowMouseMove, true);
  }

  private isPointerOverTabList(pointerClientX: number, pointerClientY: number): boolean {
    const elementUnderPointer = this.document.elementFromPoint(pointerClientX, pointerClientY);
    if (!(elementUnderPointer instanceof HTMLElement)) return false;
    return !!elementUnderPointer.closest(".tab-list, app-tab-list");
  }
}
