import { Injectable } from "@angular/core";
import { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";

@Injectable({ providedIn: "root" })
export class WorkspaceCloseGuardService {
  constructor(private readonly terminalBusyStateService: TerminalBusyStateService) {}

  confirmCloseWorkspace(actionLabel: string, workspaceId: string): Promise<boolean> {
    return this.terminalBusyStateService.confirmProceedIfNoBusyTerminalsInWorkspace(
      actionLabel,
      workspaceId,
    );
  }
}
