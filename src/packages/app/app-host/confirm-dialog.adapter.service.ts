import { Injectable } from "@angular/core";
import { ConfirmDialogPort } from "@cogno/core-api";
import { ConfirmDialogComponent, ConfirmDialogData, DialogService } from "@cogno/core-ui";

@Injectable({ providedIn: "root" })
export class ConfirmDialogAdapterService extends ConfirmDialogPort {
  constructor(private readonly dialog: DialogService) {
    super();
  }

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
