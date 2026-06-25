import { Component, input, output, signal, ViewEncapsulation } from "@angular/core";
import { IconComponent } from "../../icons/icon/icon.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";

@Component({
  selector: "app-copy-edit-delete",
  standalone: true,
  styles: [
    `
      app-copy-edit-delete {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: row;

        .icon-placeholder {
          background-color: rgba(0, 0, 0, 0);
          opacity: 0;
        }

        .buttons {
          display: flex;
          flex-direction: row;
        }

        button {
          border: none;
          background: none;
          outline: none;
          cursor: default;
          color: color-mix(in srgb, var(--foreground-color) var(--opacity-subtle), transparent);

          &:hover {
            color: var(--foreground-color);
          }
        }
      }
    `,
  ],
  template: `
    @if (!isInDeleteMode()) {
      <div class="buttons">
        @if (!enableEdit() && enableDelete() && !enableCopy()) {
          <button class="button icon-button icon-placeholder"></button>
        }
        @if (enableEdit()) {
          <button class="button icon-button" [appTooltip]="'Edit'" (click)="onEvent.emit('edit'); $event.stopPropagation()">
            <app-icon name="mdiSquareEditOutline"></app-icon>
          </button>
        }
        @if (enableCopy()) {
          <button class="button icon-button" [appTooltip]="'Copy'" (click)="onEvent.emit('copy'); $event.stopPropagation()">
            <app-icon name="mdiContentCopy"></app-icon>
          </button>
        }
        @if (enableDelete()) {
          <button class="button icon-button" [appTooltip]="'Delete'" (click)="isInDeleteMode.set(true); $event.stopPropagation()">
            <app-icon name="mdiTrashCanOutline"></app-icon>
          </button>
        }
      </div>
    } @else {
      <div class="buttons" (mouseleave)="isInDeleteMode.set(false)">
        @if (enableEdit() && enableDelete() && enableCopy()) {
          <button class="button icon-button icon-placeholder"></button>
        }
        <button class="button icon-button" (click)="onEvent.emit('delete'); isInDeleteMode.set(false); $event.stopPropagation()">
          <app-icon name="mdiCheck"></app-icon>
        </button>
        <button class="button icon-button" (click)="isInDeleteMode.set(false); $event.stopPropagation()">
          <app-icon name="mdiClose"></app-icon>
        </button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconComponent, TooltipDirective],
})
export class CopyEditDeleteComponent {
  isInDeleteMode = signal(false);

  enableDelete = input(true);
  enableEdit = input(true);
  enableCopy = input(false);

  onEvent = output<"copy" | "edit" | "delete">();
}
