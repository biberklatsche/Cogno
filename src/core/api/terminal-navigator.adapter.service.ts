import { Injectable } from "@angular/core";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { TerminalNavigator } from "./terminal-navigator-port";

@Injectable({ providedIn: "root" })
export class TerminalNavigatorAdapterService extends TerminalNavigator {
  constructor(
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    private readonly workspaceHostApplicationService: WorkspaceHostApplicationService,
  ) {
    super();
  }

  async navigateToTerminal(terminalId: string): Promise<void> {
    const workspaceId = this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    if (
      workspaceId &&
      workspaceId !== this.workspaceHostApplicationService.getActiveWorkspace()?.id
    ) {
      const workspace = this.workspaceHostApplicationService.getWorkspaceById(workspaceId);
      if (workspace) {
        await this.workspaceHostApplicationService.activateWorkspace(workspace);
      }
    }

    const tabId = this.gridListService.findTabIdByTerminalId(terminalId);
    if (tabId) {
      this.tabListService.selectTab(tabId);
    }

    this.gridListService.deferFocusTo(terminalId);
  }
}
