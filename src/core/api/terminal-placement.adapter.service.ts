import { Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { DEFAULT_WORKSPACE_COLOR, TerminalId } from "@cogno/shared/domain";
import { map, merge, Observable } from "rxjs";
import { TerminalPlacement, TerminalPlacementPort } from "./terminal-placement-port";

@Injectable({ providedIn: "root" })
export class TerminalPlacementAdapterService extends TerminalPlacementPort {
  readonly changes$: Observable<void>;

  constructor(
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    private readonly workspaceHost: WorkspaceHostApplicationService,
  ) {
    super();
    // Tab order/title changes surface on tabs$, pane moves between tabs on grids$,
    // workspace order/name/color changes on the workspace list.
    this.changes$ = merge(
      this.tabListService.tabs$,
      this.gridListService.grids$,
      toObservable(this.workspaceHost.workspaceList),
    ).pipe(map(() => undefined));
  }

  getPlacement(terminalId: TerminalId): TerminalPlacement | undefined {
    const workspaceId = this.gridListService.findWorkspaceIdentifierByTerminalId(terminalId);
    const tabId = this.gridListService.findTabIdByTerminalId(terminalId);
    if (!workspaceId || !tabId) return undefined;

    const workspaces = this.workspaceHost.workspaceList();
    const workspacePosition = workspaces.findIndex((workspace) => workspace.id === workspaceId);
    const workspace = workspaces[workspacePosition];
    if (!workspace) return undefined;

    const tabs = this.tabListService.getTabConfigs(workspaceId);
    const tabIndex = tabs.findIndex((tab) => tab.tabId === tabId);
    const tab = tabs[tabIndex];
    if (!tab) return undefined;

    return {
      workspaceId,
      workspaceName: workspace.name,
      workspaceColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR,
      workspacePosition,
      // A persisted tab may lack a system title; the card then shows the user title or nothing.
      tabTitle: tab.userTitle || tab.systemTitle || "",
      tabIndex,
    };
  }
}
