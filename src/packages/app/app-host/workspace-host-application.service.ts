import { DestroyRef, Injectable, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { GridConfig, TabConfig } from "@cogno/core-sdk";
import { WorkspaceConfiguration } from "@cogno/features/side-menu/workspace/workspace.model";
import { WorkspaceRepository } from "@cogno/features/side-menu/workspace/workspace.repository";
import { AppBus } from "../app-bus/app-bus";
import { IdCreator } from "../common/id-creator/id-creator";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TabListService } from "../tab-list/+state/tab-list.service";
import { Color } from "../common/color/color";
import { ActionFired } from "../action/action.models";

export type WorkspaceConfigUi = WorkspaceConfiguration & { isSelected: boolean; isOpen?: boolean };

export const DEFAULT_WORKSPACE_ID = "WS-DEFAULT";

@Injectable({ providedIn: "root" })
export class WorkspaceHostApplicationService {
  private readonly defaultWorkspace: WorkspaceConfiguration = {
    id: DEFAULT_WORKSPACE_ID,
    name: "Default Workspace",
    color: "grey",
    grids: [{ tabId: "TB_DEFAULT", pane: {} }],
    tabs: [{ tabId: "TB_DEFAULT" }],
  };

  readonly _workspaceList: WritableSignal<WorkspaceConfigUi[]> = signal([]);
  readonly workspaceList = this._workspaceList.asReadonly();

  constructor(
    private readonly bus: AppBus,
    private readonly sideMenuService: SideMenuService,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly gridListService: GridListService,
    private readonly tabListService: TabListService,
    destroyRef: DestroyRef,
  ) {
    this.bus.onceType$("DBInitialized").subscribe(async () => {
      const workspaces = await this.workspaceRepository.getAllWorkspaces();
      const workspaceList = [this.defaultWorkspace, ...workspaces].map((workspaceConfiguration) => ({
        ...workspaceConfiguration,
        isSelected: workspaceConfiguration.isActive ?? false,
        isOpen: false,
      }));

      if (!workspaceList.find((workspace) => workspace.isSelected)) {
        workspaceList[0].isSelected = true;
        workspaceList[0].isActive = true;
      }

      this._workspaceList.set(workspaceList);

      const activeWorkspace = workspaceList.find((workspace) => workspace.isActive);
      if (activeWorkspace) {
        await this.activateWorkspace(activeWorkspace);
      }
    });

    this.bus
      .onType$("TabRenamed")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async () => {
        const activeWorkspace = this.getActiveWorkspace();
        if (!activeWorkspace || activeWorkspace.id === DEFAULT_WORKSPACE_ID) {
          return;
        }
        await this.saveWorkspace(activeWorkspace);
      });

    this.bus
      .on$({ path: ["app"], type: "ActionFired", phase: "capture" })
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(async (message) => {
        if (message.payload !== "close_window" && message.payload !== "quit") {
          return;
        }

        const actionArguments = message.args ?? [];
        if (actionArguments.includes("workspace_saved")) {
          return;
        }

        const activeWorkspace = this.getActiveWorkspace();
        if (activeWorkspace?.autosave) {
          await this.saveWorkspace(activeWorkspace);
        }

        message.propagationStopped = true;
        this.bus.publish(
          ActionFired.create(message.payload, message.trigger, [...actionArguments, "workspace_saved"]),
        );
      });
  }

  public async restoreWorkspace(workspace: WorkspaceConfigUi): Promise<void> {
    await this.activateWorkspace(workspace);
  }

  public async activateWorkspace(workspace: WorkspaceConfigUi): Promise<void> {
    const workspaceList = [...this._workspaceList()];
    const previousActiveWorkspace = workspaceList.find((workspaceEntry) => workspaceEntry.isActive);

    if (previousActiveWorkspace && previousActiveWorkspace.id !== workspace.id && previousActiveWorkspace.autosave) {
      await this.saveWorkspace(previousActiveWorkspace);
    }

    for (const workspaceEntry of workspaceList) {
      workspaceEntry.isActive = false;
      workspaceEntry.isSelected = false;
    }

    workspace.isActive = true;
    workspace.isSelected = true;

    if (!workspace.isOpen) {
      this.tabListService.restoreTabs(workspace.tabs, workspace.id);
      this.gridListService.restoreGridsForWorkspace(workspace.grids, workspace.id);
      workspace.isOpen = true;
    }

    this.tabListService.activateWorkspace(workspace.id);
    this.gridListService.activateWorkspace(workspace.id);

    const activeTab = this.tabListService.getTabConfigs(workspace.id).find((tabConfiguration) => tabConfiguration.isActive);
    const fallbackTab = activeTab ?? this.tabListService.getTabConfigs(workspace.id)[0];
    if (fallbackTab) {
      this.tabListService.selectTab(fallbackTab.tabId);
    }

    this._workspaceList.set(workspaceList);

    if (workspace.id === DEFAULT_WORKSPACE_ID) {
      this.sideMenuService.updateBadgeColor("Workspace", undefined);
      return;
    }

    this.sideMenuService.updateBadgeColor("Workspace", workspace.color);
  }

  createWorkspaceDraft(): WorkspaceConfigUi {
    const tabId = IdCreator.newTabId();
    const paneConfiguration: GridConfig = { tabId, pane: {} };
    const tabConfiguration: TabConfig = { tabId };

    return {
      id: "",
      name: "",
      color: undefined,
      grids: [paneConfiguration],
      tabs: [tabConfiguration],
      isSelected: true,
      isActive: true,
      isOpen: false,
    };
  }

  public async save(workspace: WorkspaceConfiguration): Promise<string> {
    if (!workspace.color) {
      workspace.color = Color.fromText(workspace.name);
    }

    const isNewWorkspace = workspace.id === "";
    const previousActiveWorkspace = this.getActiveWorkspace();
    const workspaceId = await this.saveWorkspace(workspace);

    if (isNewWorkspace && previousActiveWorkspace) {
      this.tabListService.moveActiveWorkspaceRuntime(workspaceId);
      this.gridListService.moveActiveWorkspaceRuntime(workspaceId);
    }

    const workspaceList = [...this._workspaceList()];
    const existingWorkspaceIndex = workspaceList.findIndex(
      (workspaceEntry) => workspaceEntry.id === workspace.id || (workspace.id === "" && workspaceEntry.name === workspace.name),
    );

    if (existingWorkspaceIndex >= 0) {
      workspaceList[existingWorkspaceIndex] = {
        ...workspace,
        isSelected: workspaceList[existingWorkspaceIndex].isSelected,
        isActive: workspaceList[existingWorkspaceIndex].isActive,
        isOpen: workspaceList[existingWorkspaceIndex].isOpen,
      };
      this._workspaceList.set(workspaceList);
      return workspaceId;
    }

    for (const existingWorkspace of workspaceList) {
      existingWorkspace.isActive = false;
      existingWorkspace.isSelected = false;
      if (existingWorkspace.id === previousActiveWorkspace?.id) {
        existingWorkspace.isOpen = false;
      }
    }

    const workspacePosition = workspaceList.filter(
      (workspaceEntry) => workspaceEntry.id !== DEFAULT_WORKSPACE_ID,
    ).length;
    const workspaceEntry: WorkspaceConfigUi = {
      ...workspace,
      id: workspaceId,
      position: workspacePosition,
      isSelected: true,
      isActive: true,
      isOpen: true,
    };

    workspaceList.push(workspaceEntry);
    this._workspaceList.set(workspaceList);
    await this.activateWorkspace(workspaceEntry);
    return workspaceId;
  }

  async reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    if (
      sourceWorkspaceId === DEFAULT_WORKSPACE_ID ||
      targetWorkspaceId === DEFAULT_WORKSPACE_ID ||
      sourceWorkspaceId === targetWorkspaceId
    ) {
      return;
    }

    const workspaceList = [...this._workspaceList()];
    const sourceWorkspaceIndex = workspaceList.findIndex((workspace) => workspace.id === sourceWorkspaceId);
    const targetWorkspaceIndex = workspaceList.findIndex((workspace) => workspace.id === targetWorkspaceId);

    if (sourceWorkspaceIndex < 0 || targetWorkspaceIndex < 0) {
      return;
    }

    const [sourceWorkspace] = workspaceList.splice(sourceWorkspaceIndex, 1);
    workspaceList.splice(targetWorkspaceIndex, 0, sourceWorkspace);

    const persistedWorkspaceList = workspaceList.filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID);
    persistedWorkspaceList.forEach((workspace, position) => {
      workspace.position = position;
    });

    this._workspaceList.set(workspaceList);
  }

  async persistWorkspaceOrder(): Promise<void> {
    const persistedWorkspaceList = this._workspaceList().filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID);
    await this.workspaceRepository.reorderWorkspaces(persistedWorkspaceList.map((workspace) => workspace.id));
  }

  async deleteWorkspace(id: string): Promise<void> {
    const workspaceList = [...this._workspaceList()];
    const workspaceIndex = workspaceList.findIndex((workspace) => workspace.id === id);
    if (workspaceIndex === -1) {
      throw new Error("Workspace id not found");
    }

    const wasActive = workspaceList[workspaceIndex].isActive;
    const wasOpen = workspaceList[workspaceIndex].isOpen;
    await this.workspaceRepository.deleteWorkspace(id);

    if (wasOpen) {
      this.tabListService.removeWorkspaceRuntime(id);
      this.gridListService.removeWorkspaceRuntime(id);
    }

    workspaceList.splice(workspaceIndex, 1);

    if (workspaceList.length > 0) {
      if (!workspaceList.find((workspace) => workspace.isSelected)) {
        workspaceList[0].isSelected = true;
      }

      if (wasActive && !workspaceList.find((workspace) => workspace.isActive)) {
        workspaceList[0].isActive = true;
        workspaceList[0].isOpen = true;
        await this.activateWorkspace(workspaceList[0]);
        return;
      }
    }

    this._workspaceList.set(workspaceList);
  }

  async closeWorkspace(id: string): Promise<void> {
    const workspaceList = [...this._workspaceList()];
    const workspaceToClose = workspaceList.find((workspace) => workspace.id === id);
    if (!workspaceToClose || workspaceToClose.id === DEFAULT_WORKSPACE_ID || !workspaceToClose.isOpen) {
      return;
    }

    if (workspaceToClose.autosave) {
      await this.saveWorkspace(workspaceToClose);
    }

    const wasActive = workspaceToClose.isActive;
    workspaceToClose.isOpen = false;
    workspaceToClose.isActive = false;
    workspaceToClose.isSelected = false;

    this.tabListService.removeWorkspaceRuntime(id);
    this.gridListService.removeWorkspaceRuntime(id);

    if (wasActive) {
      const fallbackWorkspace =
        workspaceList.find((workspace) => workspace.isOpen) ??
        workspaceList.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);
      if (fallbackWorkspace) {
        await this.activateWorkspace(fallbackWorkspace);
        return;
      }
    }

    const selectedWorkspace = workspaceList.find((workspace) => workspace.isSelected);
    if (!selectedWorkspace) {
      const firstWorkspace = workspaceList[0];
      if (firstWorkspace) {
        firstWorkspace.isSelected = true;
      }
    }

    this._workspaceList.set(workspaceList);
  }

  getWorkspaceById(id: string): WorkspaceConfigUi | undefined {
    return this._workspaceList().find((workspace) => workspace.id === id);
  }

  private getActiveWorkspace(): WorkspaceConfigUi | undefined {
    return this._workspaceList().find((workspace) => workspace.isActive);
  }

  private async saveWorkspace(workspace: WorkspaceConfiguration): Promise<string> {
    const isNewWorkspace = workspace.id === "";
    const sourceWorkspaceId = isNewWorkspace
      ? this.getActiveWorkspace()?.id
      : this.getWorkspaceById(workspace.id)?.isOpen
        ? workspace.id
        : undefined;

    if (isNewWorkspace) {
      workspace.id = IdCreator.newWorkspaceId();
      workspace.position = this._workspaceList().filter((workspaceEntry) => workspaceEntry.id !== DEFAULT_WORKSPACE_ID).length;
    }

    if (sourceWorkspaceId) {
      workspace.grids = this.gridListService.getGridConfigs(sourceWorkspaceId);
      workspace.tabs = this.tabListService.getTabConfigs(sourceWorkspaceId);
    }

    if (isNewWorkspace) {
      await this.workspaceRepository.createWorkspace(workspace);
    } else {
      await this.workspaceRepository.updateWorkspace(workspace);
    }

    return workspace.id;
  }
}
