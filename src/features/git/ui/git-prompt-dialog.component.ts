import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";
import { DIALOG_DATA, DialogRef } from "@cogno/shared/ui";

export type GitPromptField = {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
};

export type GitPromptCheckbox = {
  readonly key: string;
  readonly label: string;
  readonly value: boolean;
};

export type GitPromptDialogData = {
  readonly message?: string;
  readonly fields: ReadonlyArray<GitPromptField>;
  readonly checkboxes?: ReadonlyArray<GitPromptCheckbox>;
  readonly confirmLabel: string;
  /** Called on every edit of a field, to derive other fields from it (clone URL -> folder). */
  readonly derive?: (key: string, values: Record<string, string>) => Record<string, string>;
};

export type GitPromptResult = {
  readonly values: Readonly<Record<string, string>>;
  readonly checks: Readonly<Record<string, boolean>>;
};

/** A small form: a few text fields and checkboxes, confirmed or dismissed. */
@Component({
  selector: "app-git-prompt-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="prompt" (submit)="$event.preventDefault(); confirm()">
      @if (data.message) {
        <p class="message">{{ data.message }}</p>
      }
      @for (field of data.fields; track field.key; let first = $first) {
        <label class="field">
          <span>{{ field.label }}</span>
          <input
            type="text"
            spellcheck="false"
            autocomplete="off"
            [attr.data-autofocus]="first ? '' : null"
            [placeholder]="field.placeholder ?? ''"
            [value]="fieldValue(field.key)"
            (input)="onInput(field.key, $event)"
          />
        </label>
      }
      @for (checkbox of data.checkboxes ?? []; track checkbox.key) {
        <label class="check">
          <input
            type="checkbox"
            [checked]="checks()[checkbox.key]"
            (change)="onCheck(checkbox.key, $event)"
          />
          <span>{{ checkbox.label }}</span>
        </label>
      }
      <div class="actions">
        <button type="button" class="button" (click)="dismiss()">Cancel</button>
        <button type="submit" class="button primary" [disabled]="!valid()">{{ data.confirmLabel }}</button>
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
      .field input {
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
      .check {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
})
export class GitPromptDialogComponent {
  readonly values = signal<Record<string, string>>({});
  readonly checks = signal<Record<string, boolean>>({});

  constructor(
    private readonly dialogRef: DialogRef<GitPromptResult>,
    @Inject(DIALOG_DATA) readonly data: GitPromptDialogData,
  ) {
    this.values.set(Object.fromEntries(data.fields.map((field) => [field.key, field.value ?? ""])));
    this.checks.set(
      Object.fromEntries((data.checkboxes ?? []).map((checkbox) => [checkbox.key, checkbox.value])),
    );
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
    const value = (event.target as HTMLInputElement).value;
    const next = { ...this.values(), [key]: value };
    this.values.set({ ...next, ...(this.data.derive?.(key, next) ?? {}) });
  }

  onCheck(key: string, event: Event): void {
    this.checks.update((checks) => ({
      ...checks,
      [key]: (event.target as HTMLInputElement).checked,
    }));
  }

  confirm(): void {
    if (!this.valid()) return;
    const values = Object.fromEntries(
      Object.entries(this.values()).map(([key, value]) => [key, value.trim()]),
    );
    this.dialogRef.close({ values, checks: this.checks() });
  }

  dismiss(): void {
    this.dialogRef.close();
  }
}
