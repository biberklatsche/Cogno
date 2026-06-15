import { Component, Inject } from "@angular/core";
import { Opener } from "@cogno/app-tauri/opener";
import { DIALOG_DATA, DialogRef } from "@cogno/core-ui";

export interface UpdateDialogData {
  readonly version: string;
  readonly releaseNotesUrl: string;
}

export type UpdateDialogResult = "install" | "later";

@Component({
  selector: "app-update-dialog",
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
      .release-notes-link {
        align-self: flex-start;
        background: none;
        border: none;
        padding: 0;
        color: var(--highlight-color);
        text-decoration: underline;
        cursor: pointer;
        font: inherit;
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
      <p class="dialog-message">Cogno {{ data.version }} is available.</p>
      <button type="button" class="release-notes-link" (click)="openReleaseNotes()">
        View release notes
      </button>
      <div class="dialog-actions">
        <button type="button" class="button" (click)="later()">Later</button>
        <button type="button" class="button primary" (click)="install()">Update now</button>
      </div>
    </div>
  `,
})
export class UpdateDialogComponent {
  constructor(
    private readonly dialogRef: DialogRef<UpdateDialogResult>,
    @Inject(DIALOG_DATA) readonly data: UpdateDialogData,
  ) {}

  install(): void {
    this.dialogRef.close("install");
  }

  later(): void {
    this.dialogRef.close("later");
  }

  openReleaseNotes(): void {
    void Opener.openUrl(this.data.releaseNotesUrl);
  }
}
