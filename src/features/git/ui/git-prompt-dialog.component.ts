import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";
import { DIALOG_DATA, DialogRef, IconComponent } from "@cogno/shared/ui";
import { GIT_SHARED_STYLES } from "./git-styles";

export type GitPromptField = {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  /** Offers a Browse button that picks the value, starting from the current one; null keeps it. */
  readonly browse?: (current: string) => Promise<string | null>;
};

export type GitPromptDialogData = {
  readonly message?: string;
  readonly fields: ReadonlyArray<GitPromptField>;
  readonly confirmLabel: string;
  /** Called on every edit of a field, to derive other fields from it (clone URL -> folder). */
  readonly derive?: (key: string, values: Record<string, string>) => Record<string, string>;
  /**
   * Work the dialog does itself on confirm, staying open while it runs: it
   * shows `label()` next to a spinner, closes once `run` says it succeeded and
   * gives the form back when it did not.
   */
  readonly submit?: {
    readonly run: (values: Readonly<Record<string, string>>) => Promise<boolean>;
    readonly label: () => string;
  };
};

export type GitPromptResult = {
  readonly values: Readonly<Record<string, string>>;
};

/** A small form: a few text fields, confirmed or dismissed. */
@Component({
  selector: "app-git-prompt-dialog",
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="prompt" (submit)="$event.preventDefault(); confirm()">
      @if (data.message) {
        <p class="message">{{ data.message }}</p>
      }
      @for (field of data.fields; track field.key; let first = $first) {
        <label class="field">
          <span>{{ field.label }}</span>
          <div class="input-row">
            <input
              type="text"
              spellcheck="false"
              autocomplete="off"
              [attr.data-autofocus]="first ? '' : null"
              [placeholder]="field.placeholder ?? ''"
              [value]="fieldValue(field.key)"
              [disabled]="running()"
              (input)="onInput(field.key, $event)"
            />
            @if (field.browse) {
              <button type="button" class="button" [disabled]="running()" (click)="browse(field)">Browse</button>
            }
          </div>
        </label>
      }
      @if (running()) {
        <div class="progress">
          <app-icon class="small-icon spin" name="mdiLoading"></app-icon>
          <span class="ellipsis">{{ data.submit?.label() }}…</span>
        </div>
      } @else {
        <div class="actions">
          <button type="button" class="button" (click)="dismiss()">Cancel</button>
          <button type="submit" class="button primary" [disabled]="!valid()">{{ data.confirmLabel }}</button>
        </div>
      }
    </form>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      .prompt {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: min(28rem, calc(100vw - 2rem));
      }
      .message {
        margin: 0;
        line-height: 1.5;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .field span {
        opacity: 0.7;
      }
      .input-row {
        display: flex;
        gap: 0.5rem;
      }
      .field input {
        flex: 1;
        min-width: 0;
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: var(--button-border-radius);
        padding: 0.4rem 0.5rem;
        font: inherit;
      }
      .field input:focus {
        outline: none;
        border-color: var(--highlight-color);
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
      /* As tall as the buttons it replaces, so the dialog does not jump. */
      .progress {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2rem;
        min-width: 0;
      }
    `,
  ],
})
export class GitPromptDialogComponent {
  readonly values = signal<Record<string, string>>({});
  /** `data.submit` is at work. */
  readonly running = signal(false);

  constructor(
    private readonly dialogRef: DialogRef<GitPromptResult>,
    @Inject(DIALOG_DATA) readonly data: GitPromptDialogData,
  ) {
    this.values.set(Object.fromEntries(data.fields.map((field) => [field.key, field.value ?? ""])));
    queueMicrotask(() =>
      document.querySelector<HTMLInputElement>("app-git-prompt-dialog [data-autofocus]")?.select(),
    );
  }

  fieldValue(key: string): string {
    return this.values()[key] ?? "";
  }

  valid(): boolean {
    const values = this.values();
    return this.data.fields.every((field) => !field.required || (values[field.key] ?? "").trim());
  }

  onInput(key: string, event: Event): void {
    this.setValue(key, (event.target as HTMLInputElement).value);
  }

  async browse(field: GitPromptField): Promise<void> {
    const picked = await field.browse?.(this.fieldValue(field.key));
    if (picked !== null && picked !== undefined) this.setValue(field.key, picked);
  }

  private setValue(key: string, value: string): void {
    const next = { ...this.values(), [key]: value };
    this.values.set({ ...next, ...(this.data.derive?.(key, next) ?? {}) });
  }

  async confirm(): Promise<void> {
    if (!this.valid() || this.running()) return;
    const values = Object.fromEntries(
      Object.entries(this.values()).map(([key, value]) => [key, value.trim()]),
    );
    if (this.data.submit) {
      this.running.set(true);
      try {
        if (!(await this.data.submit.run(values))) return;
      } finally {
        this.running.set(false);
      }
    }
    this.dialogRef.close({ values });
  }

  dismiss(): void {
    this.dialogRef.close();
  }
}
