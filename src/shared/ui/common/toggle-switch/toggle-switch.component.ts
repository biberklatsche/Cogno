import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

/**
 * Visual on/off switch. Purely presentational: it does not handle clicks
 * itself so it can be embedded in any interactive host (button, menu item,
 * label). The host is responsible for toggling `checked`.
 */
@Component({
  selector: "app-toggle-switch",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "switch",
    "[attr.aria-checked]": "checked",
    "[class.on]": "checked",
  },
  template: `<span class="knob"></span>`,
  styles: [
    `
      :host {
        --toggle-height: 1.1rem;
        --toggle-width: 1.8rem;
        --toggle-gap: 1px;

        display: block;
        flex: 0 0 auto;
        box-sizing: border-box;
        width: var(--toggle-width);
        height: var(--toggle-height);
        line-height: 0;
        border-radius: 999px;
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
        position: relative;
        overflow: hidden;
        transition: background-color .12s ease;
      }

      :host(.on) {
        background: var(--highlight-color);
      }

      .knob {
        --knob-size: calc(var(--toggle-height) - 2 * var(--toggle-gap) - 2px);

        display: block;
        box-sizing: border-box;
        position: absolute;
        top: var(--toggle-gap);
        left: var(--toggle-gap);
        width: var(--knob-size);
        height: var(--knob-size);
        border-radius: 50%;
        background: var(--foreground-color);
        transition: left .12s ease;
      }

      :host(.on) .knob {
        left: calc(100% - var(--knob-size) - var(--toggle-gap));
      }
    `,
  ],
})
export class ToggleSwitchComponent {
  @Input() checked = false;
}
