import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Icon } from "../../icon";
import { IconComponent } from "../../icons/icon/icon.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";

/** Small icon in the bottom-right corner of a letter badge. */
export interface LetterBadgeMarker {
  icon: Icon;
  /** CSS color of the icon; the foreground color when unset. */
  color?: string;
  tooltip?: string;
}

export interface LetterBadge {
  letter: string;
  /** CSS background color. */
  color: string;
  /** CSS color of the letter. */
  textColor: string;
  marker?: LetterBadgeMarker;
}

/** A colored square with one letter and an optional corner marker. */
@Component({
  selector: "app-letter-badge",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TooltipDirective],
  host: {
    "[style.color]": "badge.textColor",
    "[style.background-color]": "badge.color",
  },
  template: `
    {{ badge.letter }}
    @if (badge.marker; as marker) {
      <span
        class="marker"
        aria-hidden="true"
        [style.color]="marker.color"
        [appTooltip]="marker.tooltip ?? ''"
      >
        <app-icon [name]="marker.icon"></app-icon>
      </span>
    }
  `,
  styles: [
    `
      :host {
        position: relative;
        flex: 0 0 auto;
        width: 24px;
        min-width: 24px;
        height: 24px;
        font-size: 16px;
        font-weight: normal;
        border-radius: 0.3rem;
        display: grid;
        place-items: center;
        line-height: 26px;
        text-transform: capitalize;
      }

      .marker {
        position: absolute;
        right: -0.28rem;
        bottom: -0.28rem;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 0.8rem;
        height: 0.8rem;
        padding: 1px;
        border-radius: 999px;
        background: color-mix(in srgb, color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color)) var(--menu-opacity-ct), transparent);
        color: var(--foreground-color);
        box-shadow: 0 0 0 1px color-mix(in srgb, color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color)) var(--menu-opacity-ct), transparent);
        opacity: 0.95;
      }
    `,
  ],
})
export class LetterBadgeComponent {
  @Input({ required: true }) badge!: LetterBadge;
}
