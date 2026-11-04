import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * A card in a side panel that stands for one terminal: a button with the
 * panel's card look, marked when its terminal is the focused one. What it
 * says is projected content.
 */
@Component({
  selector: "button[appTile]",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.focused]": "focused()",
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

    :host(:hover) {
      background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
    }

    :host(.focused) {
      border-color: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
    }
  `,
})
export class TileComponent {
  /** The tile's terminal is the focused one. */
  readonly focused = input(false);
}
