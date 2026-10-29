import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

/**
 * The text field at the top of a side menu that filters what is below it. It
 * takes the focus when the menu opens (see `focusSideMenuAutofocusElement`)
 * and reports every keystroke as the new query.
 */
@Component({
  selector: "app-side-menu-search-input",
  standalone: true,
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
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="query.emit(inputValue($event))"
      (click)="$event.stopPropagation()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
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
