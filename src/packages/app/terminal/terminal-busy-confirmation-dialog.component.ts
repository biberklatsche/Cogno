import { Component, Inject } from "@angular/core";
import { DIALOG_DATA, DialogRef } from "../common/dialog";

export interface TerminalBusyConfirmationDialogData {
  readonly actionLabel: string;
  readonly busyTerminalCount: number;
}

@Component({
  selector: "app-terminal-busy-confirmation-dialog",
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
      <p class="dialog-message">
        {{ busyTerminalCountText() }} running a command. Do you really want to {{ data.actionLabel }}?
      </p>
      <div class="dialog-actions">
        <button type="button" class="button" (click)="cancel()">No</button>
        <button type="button" class="button primary" (click)="confirm()">Yes</button>
      </div>
    </div>
  `,
})
export class TerminalBusyConfirmationDialogComponent {
  constructor(
    private readonly dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) readonly data: TerminalBusyConfirmationDialogData,
  ) {}

  busyTerminalCountText(): string {
    if (this.data.busyTerminalCount === 1) {
      return "1 terminal is still busy";
    }

    return `${this.data.busyTerminalCount} terminals are still busy`;
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
