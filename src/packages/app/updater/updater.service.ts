import { DestroyRef, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Process } from "@cogno/app-tauri/process";
import { type Update, Updater } from "@cogno/app-tauri/updater";
import { DialogService } from "@cogno/core-ui";
import { ActionFired } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { ErrorReporter } from "../common/error/error-reporter";
import {
  UpdateDialogComponent,
  UpdateDialogData,
  UpdateDialogResult,
} from "./update-dialog.component";

const RELEASE_NOTES_URL = "https://cogno.rocks/releases/";

@Injectable({
  providedIn: "root",
})
export class UpdaterService {
  private readonly _availableUpdate = signal<Update | null>(null);
  readonly availableUpdate = this._availableUpdate.asReadonly();

  constructor(
    private readonly bus: AppBus,
    private readonly dialog: DialogService,
    ref: DestroyRef,
  ) {
    this.bus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(ref))
      .subscribe(async (event) => {
        if (event.payload === "check_for_updates") {
          event.performed = true;
          await this.checkForUpdates({ notify: true });
        }
      });

    void this.checkForUpdates({ notify: false });
  }

  showUpdateDialog(): void {
    const update = this._availableUpdate();
    if (update) {
      this.openUpdateDialog(update);
    }
  }

  private async checkForUpdates({ notify }: { notify: boolean }): Promise<void> {
    try {
      const update = await Updater.check();

      if (!update) {
        this._availableUpdate.set(null);
        if (notify) {
          this.notify("Cogno is up to date.");
        }
        return;
      }

      this._availableUpdate.set(update);

      if (notify) {
        this.openUpdateDialog(update);
      }
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "UpdaterService",
        context: { action: "check_for_updates" },
      });

      if (notify) {
        this.notify("Could not check for updates.");
      }
    }
  }

  private openUpdateDialog(update: Update): void {
    const dialogRef = this.dialog.open<UpdateDialogData, UpdateDialogResult>(
      UpdateDialogComponent,
      {
        title: "Update available",
        data: {
          version: update.version,
          releaseNotesUrl: `${RELEASE_NOTES_URL}${update.version}`,
        },
        hasBackdrop: true,
        closeOnBackdropClick: true,
        closeOnEscape: true,
        width: "28rem",
        maxWidth: "calc(100vw - 2rem)",
      },
    );

    const closeDialog = dialogRef.close.bind(dialogRef);
    dialogRef.close = (result?: UpdateDialogResult) => {
      closeDialog(result);
      if (result === "install") {
        void this.installUpdate(update);
      }
    };
  }

  private async installUpdate(update: Update): Promise<void> {
    try {
      await Updater.downloadAndInstall(update);
      await Process.relaunch();
    } catch (error) {
      ErrorReporter.reportException({
        error,
        handled: true,
        source: "UpdaterService",
        context: { action: "install_update" },
      });
      this.notify("Could not install the update.");
    }
  }

  private notify(body: string): void {
    this.bus.publish({
      type: "Notification",
      path: ["notification"],
      payload: { header: "Update", body },
    });
  }
}
