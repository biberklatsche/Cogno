import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { IconComponent } from "../../icons/icon/icon.component";

/** Finds the search field of a side panel: what the side menu gives the keyboard to. */
export const SIDE_MENU_SEARCH_INPUT_SELECTOR = "[data-side-menu-autofocus='true']";

/**
 * The text field at the top of a side panel that filters what is below it. It
 * takes the keyboard when its panel does (the side menu finds it by
 * `SIDE_MENU_SEARCH_INPUT_SELECTOR`) and reports every keystroke as the new query.
 * While the panel hands its query back as `value`, an x empties the field.
 */
@Component({
  selector: "app-side-menu-search-input",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      autocomplete="off"
      spellcheck="false"
      data-private="off"
      data-side-menu-autofocus="true"
      autocorrect="off"
      type="text"
      class="search-input"
      [class.clearable]="value() !== ''"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="query.emit(inputValue($event))"
      (click)="$event.stopPropagation()"
      #field
    />
    @if (value() !== "") {
      <button
        type="button"
        class="button icon-button clear"
        aria-label="Clear"
        (click)="$event.stopPropagation(); query.emit(''); field.focus()"
      >
        <app-icon name="mdiClose"></app-icon>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }

      .search-input {
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        background: color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-1)), var(--background-color));
        color: inherit;
        outline: none;
        box-sizing: border-box;
        width: 100%;
      }

      /* Room for the x, so the text never runs under it. */
      .search-input.clearable {
        padding-right: 30px;
      }

      .clear {
        position: absolute;
        top: 50%;
        right: 2px;
        transform: translateY(-50%);
      }
    `,
  ],
})
export class SideMenuSearchInputComponent {
  readonly placeholder = input("");
  readonly value = input("");
  readonly query = output<string>();

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
