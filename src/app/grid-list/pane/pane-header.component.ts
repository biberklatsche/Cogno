import {Component, input} from '@angular/core';
import {IconComponent} from "../../icons/icon/icon.component";
import {GridListService} from "../+state/grid-list.service";
import {toSignal} from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-pane-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (shouldShow()) {
      <div class="pane-header">
        <span class="cwd">{{cwd()}}</span>
        <button class="close" type="button" (click)="$event.stopPropagation(); closePane()">
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
export class PaneHeaderComponent {
  cwd = input.required<string>();
  terminalId = input.required<string>();

  shouldShow = toSignal(this.gridListService.activeGridIsSplit$, { initialValue: false });

  constructor(private gridListService: GridListService) {}

  closePane() {
    this.gridListService.removePane(this.terminalId());
  }
}
