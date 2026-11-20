import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { StartEllipsisDirective } from "../text/start-ellipsis.directive";
import { TooltipDirective } from "../tooltip/tooltip.directive";

/**
 * A tab's name as its header shows it, framed like a tab so it reads as one:
 * tinted in the tab's colour when the user gave it one, neutral otherwise.
 * Long names lose their start, so the distinctive end stays readable.
 */
@Component({
  selector: "app-tab-chip",
  standalone: true,
  imports: [StartEllipsisDirective, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.colored]": "!!color()",
    "[style.--tab-color]": "color() ? 'var(--color-' + color() + ')' : null",
  },
  template: `<span class="title" [appStartEllipsis]="title()" [appTooltip]="tooltip()"></span>`,
  styles: `
    :host {
      --tab-color: var(--foreground-color);
      display: block;
      min-width: 0;
      padding: 0 6px;
      /* The frame is drawn inside: a border would make the chip taller than its
         line, and the agent cards' footer is exactly one line high. */
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tab-color) 25%, transparent);
      border-radius: 4px;
      background: color-mix(in srgb, var(--tab-color) 8%, transparent);
    }

    /* A block, so the ellipsis directive can measure it: an inline span has no width of its own. */
    .title {
      display: block;
      white-space: nowrap;
      overflow: hidden;
    }

    :host(.colored) {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tab-color) 60%, transparent);
      background: color-mix(in srgb, var(--tab-color) 25%, transparent);
    }
  `,
})
export class TabChipComponent {
  readonly title = input.required<string>();
  /** Colour name of the tab, absent when it has none. */
  readonly color = input<string | undefined>(undefined);
  readonly tooltip = input("");
}
