import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { fromPickerValue, toCssColor, toPickerValue } from "./hex-color";

/**
 * A hex color as the config writes it (no `#`, 3 to 8 digits): a swatch that
 * shows it, the text to edit it, and the system picker behind the swatch. The
 * picker knows no alpha, so a pick keeps the alpha digits the value had.
 * Emits the new value; the host decides what to do with it.
 */
@Component({
  selector: "app-color-field",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="swatch" [class.invalid]="!css()" [style.--swatch]="css() ?? 'transparent'" title="Pick a color">
      <input
        type="color"
        class="picker"
        [value]="pickerValue() ?? '#000000'"
        (input)="valueChange.emit(fromPicker(picker.value))"
        #picker
      />
    </label>
    <input
      type="text"
      class="hex"
      spellcheck="false"
      autocomplete="off"
      [value]="value()"
      [placeholder]="placeholder()"
      (change)="valueChange.emit(text.value.trim().replace('#', ''))"
      #text
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 100%;
      }
      .swatch {
        position: relative;
        flex: 0 0 auto;
        width: 1.9rem;
        height: 1.9rem;
        border-radius: var(--button-border-radius, 6px);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-4)), var(--background-color));
        /* A checkerboard under the color, so alpha is visible. */
        background:
          linear-gradient(var(--swatch), var(--swatch)),
          repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 10px 10px;
        cursor: pointer;
        overflow: hidden;
      }
      .swatch.invalid {
        background: repeating-linear-gradient(45deg, #f004 0 4px, transparent 4px 8px);
      }
      .picker {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }
      .hex {
        flex: 1 1 auto;
        min-width: 0;
        font-family: var(--terminal-font-family, monospace);
      }
    `,
  ],
})
export class ColorFieldComponent {
  /** The color as the config spells it, without `#`. */
  readonly value = input("");
  readonly placeholder = input("");
  readonly valueChange = output<string>();

  readonly css = computed(() => toCssColor(this.value()));
  readonly pickerValue = computed(() => toPickerValue(this.value()));

  fromPicker(picked: string): string {
    return fromPickerValue(picked, this.value());
  }
}
