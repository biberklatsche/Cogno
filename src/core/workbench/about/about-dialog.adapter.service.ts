import { Injectable } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { DialogService } from "@cogno/shared/ui";
import { AboutDialogComponent } from "./about-dialog.component";

@Injectable({ providedIn: "root" })
export class AboutDialogAdapterService {
  constructor(
    actions: ActionHandlers,
    private readonly dialog: DialogService,
  ) {
    actions.handle("open_about", () => {
      this.open();
    });
  }

  private open(): void {
    this.dialog.open(AboutDialogComponent, {
      title: "About",
      hasBackdrop: true,
      closeOnBackdropClick: true,
      closeOnEscape: true,
      showCloseButton: true,
    });
  }
}
