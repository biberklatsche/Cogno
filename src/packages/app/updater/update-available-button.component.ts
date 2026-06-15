import { ChangeDetectionStrategy, Component } from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/core-ui";
import { UpdaterService } from "./updater.service";

@Component({
  selector: "app-update-available-button",
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  template: `
    @if (updaterService.availableUpdate()) {
      <button
        type="button"
        class="update-available-button"
        appTooltip="Update available"
        aria-label="Update available"
        (click)="updaterService.showUpdateDialog()"
      >
        <app-icon name="mdiRocketLaunch"></app-icon>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        height: 100%;
      }

      .update-available-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 22px;
        width: 22px;
        border: none;
        border-radius: 0.35rem;
        background: transparent;
        color: var(--highlight-color);
        cursor: pointer;
      }

      .update-available-button:hover,
      .update-available-button:focus-visible {
        background: var(--background-color-20l);
        outline: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailableButtonComponent {
  constructor(protected readonly updaterService: UpdaterService) {}
}
