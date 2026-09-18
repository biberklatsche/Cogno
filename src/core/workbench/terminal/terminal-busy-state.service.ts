import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { TerminalId } from "@cogno/shared/domain";
import { ConfirmDialogComponent, ConfirmDialogData, DialogService } from "@cogno/shared/ui";
import { GridListService } from "../grid-list/+state/grid-list.service";

@Injectable({ providedIn: "root" })
export class TerminalBusyStateService {
  private readonly busyTerminalWorkspaceIds = new Map<TerminalId, string | undefined>();

  constructor(
    private readonly appBus: AppBus,
    private readonly dialogService: DialogService,
    private readonly gridListService: GridListService,
    sessionRegistry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    sessionRegistry.facts$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ terminalId, fact }) => {
        if (fact.type !== "busyChanged") {
          return;
        }
        if (fact.isBusy) {
          this.busyTerminalWorkspaceIds.set(
            terminalId,
            this.resolveWorkspaceIdentifierForTerminal(terminalId),
          );
          return;
        }
        this.busyTerminalWorkspaceIds.delete(terminalId);
      });

    this.appBus
      .on$("TerminalRemoved")
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
    return this.getBusyTerminalCountInWorkspace(workspaceId) > 0;
  }

  getBusyTerminalCountInWorkspace(workspaceId: string): number {
    let count = 0;
    for (const terminalId of this.busyTerminalWorkspaceIds.keys()) {
      if (this.resolveWorkspaceIdentifierForTerminal(terminalId) === workspaceId) {
        count++;
      }
    }
    return count;
  }

  confirmProceedIfNoBusyTerminals(actionLabel: string): Promise<boolean> {
    return this.confirmProceed(actionLabel, this.getBusyTerminalCount());
  }

  /** Asks only about the terminals the action ends: the ones of that workspace. */
  confirmProceedIfNoBusyTerminalsInWorkspace(
    actionLabel: string,
    workspaceId: string,
  ): Promise<boolean> {
    return this.confirmProceed(actionLabel, this.getBusyTerminalCountInWorkspace(workspaceId));
  }

  private async confirmProceed(actionLabel: string, count: number): Promise<boolean> {
    if (count === 0) {
      return true;
    }

    const countText =
      count === 1 ? "1 terminal is still busy" : `${count} terminals are still busy`;
    const dialogRef = this.dialogService.open<ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      title: "Running Processes",
      data: {
        message: `${countText}. Do you really want to ${actionLabel}?`,
        confirmLabel: "Yes",
        cancelLabel: "No",
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

  private resolveWorkspaceIdentifierForTerminal(terminalId: TerminalId): string | undefined {
    const workspaceIdentifier =
      this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    this.busyTerminalWorkspaceIds.set(terminalId, workspaceIdentifier);
    return workspaceIdentifier;
  }
}
