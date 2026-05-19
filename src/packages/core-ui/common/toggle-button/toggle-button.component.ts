import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "app-toggle-button",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: "display: contents" },
  template: `
    <button type="button" [class.is-active]="active()">
      <ng-content></ng-content>
    </button>
  `,
  styles: [
    `
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--background-color-20l);
        background: var(--background-color-10l);
        color: inherit;
        border-radius: var(--button-border-radius, 6px);
        height: 2rem;
        min-width: 2rem;
        padding: 0 0.5rem;
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      }

      button.is-active {
        background: var(--highlight-color-ct2);
        border-color: var(--highlight-color);
        color: var(--highlight-color);
        font-weight: 600;
      }
    `,
  ],
})
export class ToggleButtonComponent {
  readonly active = input<boolean>(false);
}
