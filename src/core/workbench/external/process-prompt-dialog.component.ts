import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";
import { DIALOG_DATA, DialogRef } from "@cogno/shared/ui";
import { isSecretPrompt, ProcessPrompt } from "./process-prompt";

/**
 * The dialog a process gets instead of a terminal prompt. Confirming answers
 * the process; dismissing refuses the prompt, and the process sees a failed
 * read - git then reports that it could not read the credential.
 */
@Component({
  selector: "app-process-prompt-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="prompt" (submit)="$event.preventDefault(); confirm()">
      <pre class="message">{{ data.message }}</pre>
      @if (data.kind !== "confirm") {
        <input
          #field
          class="field"
          [type]="secret ? 'password' : 'text'"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          [value]="value()"
          (input)="value.set(field.value)"
        />
      }
      <div class="actions">
        @if (data.kind === "confirm") {
          <button type="button" class="button" (click)="dialogRef.close('no')">No</button>
          <button type="submit" class="button primary">Yes</button>
        } @else {
          <button type="button" class="button" (click)="dialogRef.close()">Cancel</button>
          <button type="submit" class="button primary">OK</button>
        }
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
  readonly secret: boolean;

  constructor(
    readonly dialogRef: DialogRef<string>,
    @Inject(DIALOG_DATA) readonly data: ProcessPrompt,
  ) {
    this.secret = isSecretPrompt(data.kind);
    queueMicrotask(() =>
      document.querySelector<HTMLInputElement>("app-process-prompt-dialog .field")?.focus(),
    );
  }

  confirm(): void {
    this.dialogRef.close(this.data.kind === "confirm" ? "yes" : this.value());
  }
}
