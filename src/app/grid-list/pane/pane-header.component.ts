import {Component, OnDestroy, input} from '@angular/core';
import {IconComponent} from "../../icons/icon/icon.component";
import {GridListService} from "../+state/grid-list.service";
import {toSignal} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-pane-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (shouldShow()) {
      <div class="pane-header" (mousedown)="startPaneSwapDrag($event)" (mouseenter)="updatePaneSwapTarget()">
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
  `
})
export class PaneHeaderComponent implements OnDestroy {
  private readonly handleWindowMouseUp = (event: MouseEvent): void => this.onWindowMouseUp(event);

  cwd = input.required<string>();
  terminalId = input.required<string>();

  shouldShow = toSignal(this.gridListService.activeGridIsSplit$, { initialValue: false });

  constructor(private gridListService: GridListService) {}

  ngOnDestroy(): void {
    this.removeWindowMouseUpListener();
  }

  startPaneSwapDrag(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.gridListService.startPaneSwapDrag(this.terminalId());
    this.gridListService.focusActiveTerminal();
    this.addWindowMouseUpListener();
  }

  updatePaneSwapTarget(): void {
    if (!this.gridListService.isPaneSwapDragActive()) return;
    this.gridListService.updatePaneSwapTarget(this.terminalId());
  }

  closePane() {
    this.gridListService.removePane(this.terminalId());
  }

  private onWindowMouseUp(event: MouseEvent): void {
    if (event.button === 0 && this.gridListService.isPaneSwapDragActive()) {
      this.gridListService.finishPaneSwapDrag();
      this.gridListService.focusActiveTerminal();
    } else {
      this.gridListService.cancelPaneSwapDrag();
    }
    this.removeWindowMouseUpListener();
  }

  private addWindowMouseUpListener(): void {
    window.addEventListener('mouseup', this.handleWindowMouseUp, true);
  }

  private removeWindowMouseUpListener(): void {
    window.removeEventListener('mouseup', this.handleWindowMouseUp, true);
  }
}
