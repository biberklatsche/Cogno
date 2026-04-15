import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "../app-bus/app-bus";
import { DialogService } from "../common/dialog";
import { TerminalId } from "../grid-list/+model/model";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TerminalBusyConfirmationDialogComponent } from "./terminal-busy-confirmation-dialog.component";

@Injectable({ providedIn: "root" })
export class TerminalBusyStateService {
  private readonly busyTerminalWorkspaceIds = new Map<TerminalId, string | undefined>();

  constructor(
    private readonly appBus: AppBus,
    private readonly dialogService: DialogService,
    private readonly gridListService: GridListService,
    destroyRef: DestroyRef,
  ) {
    this.appBus
      .onType$("TerminalBusyChanged", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((terminalBusyChangedEvent) => {
        const terminalBusyPayload = terminalBusyChangedEvent.payload;
        if (!terminalBusyPayload) {
          return;
        }

        const terminalId = terminalBusyPayload.terminalId;
        if (terminalBusyPayload.isBusy) {
          this.busyTerminalWorkspaceIds.set(
            terminalId,
            this.resolveWorkspaceIdentifierForTerminal(terminalId),
          );
          return;
        }

        this.busyTerminalWorkspaceIds.delete(terminalId);
      });

    this.appBus
      .onType$("TerminalRemoved", { path: ["app", "terminal"] })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((terminalRemovedEvent) => {
        if (!terminalRemovedEvent.payload) {
          return;
        }

        this.busyTerminalWorkspaceIds.delete(terminalRemovedEvent.payload);
      });
  }

  hasBusyTerminals(): boolean {
    return this.busyTerminalWorkspaceIds.size > 0;
  }

  getBusyTerminalCount(): number {
    return this.busyTerminalWorkspaceIds.size;
  }

  hasBusyTerminalsInWorkspace(workspaceId: string): boolean {
    for (const terminalId of this.busyTerminalWorkspaceIds.keys()) {
      if (this.resolveWorkspaceIdentifierForTerminal(terminalId) === workspaceId) {
        return true;
      }
    }

    return false;
  }

  async confirmProceedIfNoBusyTerminals(actionLabel: string): Promise<boolean> {
    if (!this.hasBusyTerminals()) {
      return true;
    }

    const dialogRef = this.dialogService.open(TerminalBusyConfirmationDialogComponent, {
      title: "Running Processes",
      data: {
        actionLabel,
        busyTerminalCount: this.getBusyTerminalCount(),
      },
      hasBackdrop: true,
      showCloseButton: false,
      closeOnBackdropClick: false,
      closeOnEscape: false,
      width: "32rem",
      maxWidth: "calc(100vw - 2rem)",
    });

    return new Promise<boolean>((resolve) => {
      const closeDialog = dialogRef.close.bind(dialogRef);
      dialogRef.close = (result?: boolean) => {
        resolve(result ?? false);
        closeDialog(result);
      };
    });
  }

  async confirmProceedIfNoBusyTerminalsInWorkspace(
    actionLabel: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!this.hasBusyTerminalsInWorkspace(workspaceId)) {
      return true;
    }

    return this.confirmProceedIfNoBusyTerminals(actionLabel);
  }

  private resolveWorkspaceIdentifierForTerminal(terminalId: TerminalId): string | undefined {
    const workspaceIdentifier =
      this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    this.busyTerminalWorkspaceIds.set(terminalId, workspaceIdentifier);
    return workspaceIdentifier;
  }
}
