import { Injectable } from "@angular/core";
import { WorkspaceCloseGuardContract } from "@cogno/core-api";
import { TerminalBusyStateService } from "../terminal/terminal-busy-state.service";

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
