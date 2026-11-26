import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { markHits } from "./settings-view";

/** A text of the settings panel with the search's hits in it marked. */
@Component({
  selector: "app-marked-text",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // On one line: a line break between the pieces would show as a space inside a word.
  template: `@for (piece of pieces(); track $index) {@if (piece.hit) {<mark>{{ piece.text }}</mark>} @else {<span>{{ piece.text }}</span>}}`,
  styles: [
    `
      /* A hit reads like a match in the autocomplete. */
      mark {
        background: none;
        color: var(--highlight-color);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    `,
  ],
})
export class MarkedTextComponent {
  readonly text = input.required<string>();
  /** The search's terms, lowercased; none marks nothing. */
  readonly terms = input.required<ReadonlyArray<string>>();
  readonly pieces = computed(() => markHits(this.text(), this.terms()));
}
