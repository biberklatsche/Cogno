import { Injectable } from "@angular/core";
import { TerminalGateway, TerminalNavigator } from "@cogno/core-api";
import { AppBus } from "../app-bus/app-bus";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TabListService } from "../tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "./workspace-host-application.service";

@Injectable({ providedIn: "root" })
export class TerminalNavigatorAdapterService extends TerminalNavigator {
  constructor(
    private readonly appBus: AppBus,
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    private readonly terminalGateway: TerminalGateway,
    private readonly workspaceHostApplicationService: WorkspaceHostApplicationService,
  ) {
    super();

    this.appBus.onType$("RevealTerminal", { path: ["app", "terminal"] }).subscribe((event) => {
      if (event.payload) {
        this.navigateToTerminal(event.payload).catch((error: unknown) => {
          console.error("[terminal-navigator] Failed to navigate to terminal:", error);
        });
      }
    });
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

    this.terminalGateway.focusTerminal(terminalId);
  }
}
