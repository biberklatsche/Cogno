import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";
import { DIALOG_DATA, DialogRef } from "@cogno/shared/ui";

/**
 * A process without a terminal asks for something nobody in the workbench
 * understands: the text as the process printed it and a hidden field. OK
 * answers, Cancel refuses and the process sees a failed read.
 */
@Component({
  selector: "app-process-prompt-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="prompt" (submit)="$event.preventDefault(); dialogRef.close(value())">
      <pre class="message">{{ text }}</pre>
      <input
        #field
        class="field"
        type="password"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        [value]="value()"
        (input)="value.set(field.value)"
      />
      <div class="actions">
        <button type="button" class="button" (click)="dialogRef.close()">Cancel</button>
        <button type="submit" class="button primary">OK</button>
      </div>
    </form>
  `,
  styles: [
    `
      .prompt {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: min(28rem, calc(100vw - 2rem));
      }
      .message {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: inherit;
        line-height: 1.5;
      }
      .field {
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: var(--button-border-radius);
        padding: 0.4rem 0.5rem;
        font: inherit;
      }
      .field:focus {
        outline: none;
        border-color: var(--highlight-color);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
})
export class ProcessPromptDialogComponent {
  readonly value = signal("");

  constructor(
    readonly dialogRef: DialogRef<string>,
    @Inject(DIALOG_DATA) readonly text: string,
  ) {
    queueMicrotask(() =>
      document.querySelector<HTMLInputElement>("app-process-prompt-dialog .field")?.focus(),
    );
  }
}
