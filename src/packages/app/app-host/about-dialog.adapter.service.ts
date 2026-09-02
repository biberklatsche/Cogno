import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { DialogService } from "@cogno/shared/ui";
import { AboutDialogComponent } from "./about-dialog.component";

@Injectable({ providedIn: "root" })
export class AboutDialogAdapterService {
  constructor(
    bus: AppBus,
    destroyRef: DestroyRef,
    private readonly dialog: DialogService,
  ) {
    bus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (event.payload === "open_about") {
          this.open();
        }
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
