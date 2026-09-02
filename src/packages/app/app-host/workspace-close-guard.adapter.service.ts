import { Injectable } from "@angular/core";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WorkspaceCloseGuardContract } from "@cogno/features/side-menu/ports";

@Injectable({ providedIn: "root" })
export class WorkspaceCloseGuardAdapterService implements WorkspaceCloseGuardContract {
  constructor(private readonly terminalBusyStateService: TerminalBusyStateService) {}

  confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean> {
    return this.terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
      actionLabel,
      workspaceId,
    );
  }
}
