import { Component, Inject } from "@angular/core";
import { DIALOG_DATA } from "./dialog.tokens";
import { DialogRef } from "./dialog-ref";

export interface ConfirmDialogData {
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  styles: [
    `
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: min(28rem, calc(100vw - 2rem));
      }
      .dialog-message {
        margin: 0;
        line-height: 1.5;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }
    `,
  ],
  template: `
    <div class="dialog-content">
      <p class="dialog-message">{{ data.message }}</p>
      <div class="dialog-actions">
        <button type="button" class="button" (click)="dismiss()">
          {{ data.cancelLabel ?? "Cancel" }}
        </button>
        <button type="button" class="button primary" (click)="confirm()">
          {{ data.confirmLabel ?? "OK" }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  constructor(
    private readonly dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) readonly data: ConfirmDialogData,
  ) {}

  confirm(): void {
    this.dialogRef.close(true);
  }

  dismiss(): void {
    this.dialogRef.close(false);
  }
}
