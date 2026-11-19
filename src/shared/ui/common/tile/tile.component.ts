import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * A card in a side panel that stands for one terminal: a button with the
 * panel's card look, marked when its terminal is the focused one. What it
 * says is projected content.
 *
 * A tinted tile marks the open one the way a coloured tab does: more of its
 * colour, a full-colour border.
 */
@Component({
  selector: "button[appTile]",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.focused]": "focused()",
    "[class.tinted]": "!!tint()",
    "[style.--tile-tint]": "tint()",
  },
  template: `<ng-content></ng-content>`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      padding: 0.65rem 0.8rem;
      border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      border-radius: 10px;
      background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
      color: inherit;
      font: inherit;
      cursor: default;
      text-align: left;
      transition: background 0.1s;
    }

    :host(.focused) {
      border-color: var(--selected-border-color);
      background: var(--selected-background);
    }

    :host(:hover) {
      border-color: var(--hover-border-color);
      background: var(--hover-background);
    }

    :host(.tinted) {
      border-color: color-mix(in srgb, var(--tile-tint) 55%, transparent);
      background: color-mix(in srgb, var(--tile-tint) 9%, var(--background-color));
    }

    :host(.tinted:hover) {
      background: color-mix(in srgb, var(--tile-tint) 14%, var(--background-color));
    }

    :host(.tinted.focused) {
      border-color: var(--tile-tint);
      background: color-mix(in srgb, var(--tile-tint) 20%, var(--background-color));
    }

    :host(.tinted.focused:hover) {
      background: color-mix(in srgb, var(--tile-tint) 25%, var(--background-color));
    }
  `,
})
export class TileComponent {
  /** The tile's terminal is the focused one. */
  readonly focused = input(false);
  /** A colour the tile is tinted in; none keeps the neutral look. */
  readonly tint = input<string>();
}
