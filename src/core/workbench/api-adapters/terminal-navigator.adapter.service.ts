import { Injectable } from "@angular/core";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";

@Injectable({ providedIn: "root" })
export class TerminalNavigatorAdapterService extends TerminalNavigator {
  constructor(
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    private readonly workspaceHostApplicationService: WorkspaceHostApplicationService,
    private readonly bus: AppBus,
  ) {
    super();
  }

  async navigateToTerminal(terminalId: string): Promise<void> {
    await this.showWorkspaceOf(terminalId);

    const tabId = this.gridListService.findTabIdByTerminalId(terminalId);
    if (tabId) {
      this.tabListService.selectTab(tabId);
    }

    this.gridListService.deferFocusTo(terminalId);
  }

  async openTabAt(cwd: string, besideTerminalId: string): Promise<void> {
    // A new tab lands in the shown workspace, so that is the terminal's.
    await this.showWorkspaceOf(besideTerminalId);
    this.bus.publish({
      type: "CreateTab",
      payload: {
        tabId: IdCreator.newTabId(),
        shellName: this.gridListService.findShellNameByTerminalId(besideTerminalId),
        // The folder is on the terminal's machine: the tab opens there too.
        host: this.gridListService.findHostByTerminalId(besideTerminalId),
        workingDir: cwd,
        isActive: true,
      },
    });
  }

  private async showWorkspaceOf(terminalId: string): Promise<void> {
    const workspaceId = this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    if (
      !workspaceId ||
      workspaceId === this.workspaceHostApplicationService.getActiveWorkspace()?.id
    ) {
      return;
    }
    const workspace = this.workspaceHostApplicationService.getWorkspaceById(workspaceId);
    if (workspace) {
      // Like switching by hand: the workspace left behind is saved first.
      await this.workspaceHostApplicationService.restoreWorkspace(workspace);
    }
  }
}
