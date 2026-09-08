import { Injectable } from "@angular/core";
import { ConfirmDialogComponent, ConfirmDialogData, DialogService } from "@cogno/shared/ui";

/**
 * The coding-agent's confirm dialog. A confirm is plain UI, so the feature
 * asks the shared dialog service directly rather than through an app-provided
 * port.
 */
@Injectable({ providedIn: "root" })
export class CodingAgentConfirmDialogService {
  constructor(private readonly dialog: DialogService) {}

  confirm(title: string, message: string): Promise<boolean> {
    const dialogRef = this.dialog.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title,
      data: { message },
      hasBackdrop: true,
      showCloseButton: false,
      closeOnBackdropClick: true,
      closeOnEscape: true,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });

    return new Promise<boolean>((resolve) => {
      const closeDialog = dialogRef.close.bind(dialogRef);
      dialogRef.close = (result?: boolean) => {
        resolve(result ?? false);
        closeDialog(result);
      };
    }).catch(() => false);
  }
}
