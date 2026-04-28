import { DestroyRef, Injectable, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { defaultWorkspaceIdContract, PersistedPaneConfigurationContract } from "@cogno/core-api";
import {
  WorkspaceConfiguration,
  WorkspaceState,
  WorkspaceStateUseCase,
} from "@cogno/core-domain/workspace";
import { merge } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { Color } from "../common/color/color";
import { IdCreator } from "../common/id-creator/id-creator";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { TabListService } from "../tab-list/+state/tab-list.service";
import { WorkspaceRepository } from "./workspace.repository";

export const DEFAULT_WORKSPACE_ID = defaultWorkspaceIdContract;

interface DirtyTrackingPaneSignature {
  readonly splitDirection?: PersistedPaneConfigurationContract["splitDirection"];
  readonly ratio?: number;
  readonly leftChild?: DirtyTrackingPaneSignature;
  readonly rightChild?: DirtyTrackingPaneSignature;
  readonly shellName?: string;
  readonly workingDir?: string;
}

interface DirtyTrackingWorkspaceSignature {
  readonly tabs: ReadonlyArray<{
    readonly tabId: string;
  }>;
  readonly grids: ReadonlyArray<{
    readonly tabId: string;
    readonly pane: DirtyTrackingPaneSignature;
  }>;
}

@Injectable({ providedIn: "root" })
export class WorkspaceHostApplicationService {
  private readonly defaultWorkspace =
    WorkspaceStateUseCase.createDefaultWorkspace(DEFAULT_WORKSPACE_ID);
  private readonly persistedWorkspaceRuntimeSignatureById = new Map<string, string>();
  private synchronizingWorkspaceRuntimeDepth = 0;

  readonly _workspaceList: WritableSignal<WorkspaceState[]> = signal([]);
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
      const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
        workspaces,
        this.defaultWorkspace,
      );

      for (const workspace of workspaces) {
        this.persistedWorkspaceRuntimeSignatureById.set(
          workspace.id,
          this.createWorkspaceRuntimeSignature(workspace.tabs, workspace.grids),
        );
      }

      this._workspaceList.set(workspaceList);

      const activeWorkspace = WorkspaceStateUseCase.getActiveWorkspace(workspaceList);
      if (activeWorkspace) {
        await this.activateWorkspace(activeWorkspace);
      }
    });

    merge(this.tabListService.tabs$, this.gridListService.grids$)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => {
        if (this.synchronizingWorkspaceRuntimeDepth > 0) {
          return;
        }
        this.refreshDirtyStateForActiveWorkspace();
      });
  }

  public async restoreWorkspace(workspace: WorkspaceState): Promise<void> {
    await this.activateWorkspace(workspace);
  }

  public async activateWorkspace(workspace: WorkspaceState): Promise<void> {
    await this.runWithoutDirtyTracking(async () => {
      const activationPlan = WorkspaceStateUseCase.activateWorkspace(
        this._workspaceList(),
        workspace.id,
      );
      const workspaceToActivate = activationPlan.workspaceToActivate;

      if (!workspaceToActivate) {
        return;
      }

      if (activationPlan.shouldRestoreRuntime) {
        this.tabListService.restoreTabs(workspaceToActivate.tabs, workspaceToActivate.id);
        this.gridListService.restoreGridsForWorkspace(
          workspaceToActivate.grids,
          workspaceToActivate.id,
        );
      }

      this.tabListService.activateWorkspace(workspaceToActivate.id);
      this.gridListService.activateWorkspace(workspaceToActivate.id);

      const activeTab = this.tabListService
        .getTabConfigs(workspaceToActivate.id)
        .find((tabConfiguration) => tabConfiguration.isActive);
      const fallbackTab =
        activeTab ?? this.tabListService.getTabConfigs(workspaceToActivate.id)[0];
      if (fallbackTab) {
        this.tabListService.selectTab(fallbackTab.tabId);
      }

      this._workspaceList.set(activationPlan.workspaceList);
      this.refreshDirtyStateForWorkspace(workspaceToActivate.id);

      if (workspaceToActivate.id === DEFAULT_WORKSPACE_ID) {
        this.sideMenuService.updateBadgeColor("Workspace", undefined);
        return;
      }

      this.sideMenuService.updateBadgeColor("Workspace", workspaceToActivate.color);
    });
  }

  createWorkspaceDraft(): WorkspaceState {
    return WorkspaceStateUseCase.createWorkspaceDraft(IdCreator.newTabId());
  }

  public async save(workspace: WorkspaceConfiguration): Promise<string> {
    if (!workspace.color) {
      workspace.color = Color.fromText(workspace.name);
    }

    const isNewWorkspace = workspace.id === "";
    const previousActiveWorkspace = this.getActiveWorkspace();
    const workspaceId = await this.persistWorkspaceConfiguration(workspace);

    await this.runWithoutDirtyTracking(async () => {
      if (isNewWorkspace && previousActiveWorkspace) {
        this.tabListService.moveActiveWorkspaceRuntime(workspaceId);
        this.gridListService.moveActiveWorkspaceRuntime(workspaceId);
      }

      const upsertPlan = WorkspaceStateUseCase.upsertWorkspace(
        this._workspaceList(),
        workspace,
        previousActiveWorkspace?.id,
      );

      this._workspaceList.set(upsertPlan.workspaceList);
      this.setWorkspaceDirtyState(workspaceId, false);

      if (upsertPlan.wasExisting || !upsertPlan.workspaceEntry) {
        return;
      }

      await this.activateWorkspace(upsertPlan.workspaceEntry);
    });

    return workspaceId;
  }

  public async saveWorkspace(workspaceId: string): Promise<void> {
    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      return;
    }

    const workspace = this.getWorkspaceById(workspaceId);
    if (!workspace) {
      return;
    }

    const workspaceToSave: WorkspaceConfiguration = {
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      grids: workspace.grids,
      tabs: workspace.tabs,
      position: workspace.position,
      isActive: workspace.isActive,
    };
    await this.save(workspaceToSave);
  }

  async reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    this._workspaceList.set(
      WorkspaceStateUseCase.reorderWorkspaces(
        this._workspaceList(),
        sourceWorkspaceId,
        targetWorkspaceId,
      ),
    );
  }

  async persistWorkspaceOrder(): Promise<void> {
    const persistedWorkspaceList = this._workspaceList().filter(
      (workspace) => workspace.id !== DEFAULT_WORKSPACE_ID,
    );
    await this.workspaceRepository.reorderWorkspaces(
      persistedWorkspaceList.map((workspace) => workspace.id),
    );
  }

  async deleteWorkspace(id: string): Promise<void> {
    const deletePlan = WorkspaceStateUseCase.deleteWorkspace(this._workspaceList(), id);
    await this.workspaceRepository.deleteWorkspace(id);
    this.persistedWorkspaceRuntimeSignatureById.delete(id);

    await this.runWithoutDirtyTracking(async () => {
      if (deletePlan.deletedWorkspace?.isOpen) {
        this.tabListService.removeWorkspaceRuntime(id);
        this.gridListService.removeWorkspaceRuntime(id);
      }

      this._workspaceList.set(deletePlan.workspaceList);

      if (!deletePlan.workspaceToActivateId) {
        return;
      }

      const fallbackWorkspace = this.getWorkspaceById(deletePlan.workspaceToActivateId);
      if (fallbackWorkspace) {
        await this.activateWorkspace(fallbackWorkspace);
      }
    });
  }

  async closeWorkspace(id: string): Promise<void> {
    const closePlan = WorkspaceStateUseCase.closeWorkspace(this._workspaceList(), id);
    const workspaceToClose = closePlan.closedWorkspace;
    if (
      !workspaceToClose ||
      workspaceToClose.id === DEFAULT_WORKSPACE_ID ||
      !workspaceToClose.isOpen
    ) {
      return;
    }

    await this.runWithoutDirtyTracking(async () => {
      this.tabListService.removeWorkspaceRuntime(id);
      this.gridListService.removeWorkspaceRuntime(id);
      this._workspaceList.set(closePlan.workspaceList);

      if (!closePlan.workspaceToActivateId) {
        return;
      }

      const fallbackWorkspace = this.getWorkspaceById(closePlan.workspaceToActivateId);
      if (fallbackWorkspace) {
        await this.activateWorkspace(fallbackWorkspace);
      }
    });
  }

  getWorkspaceById(id: string): WorkspaceState | undefined {
    return WorkspaceStateUseCase.getWorkspaceById(this._workspaceList(), id);
  }

  private getActiveWorkspace(): WorkspaceState | undefined {
    return WorkspaceStateUseCase.getActiveWorkspace(this._workspaceList());
  }

  private async persistWorkspaceConfiguration(workspace: WorkspaceConfiguration): Promise<string> {
    const isNewWorkspace = workspace.id === "";
    const sourceWorkspaceId = isNewWorkspace
      ? this.getActiveWorkspace()?.id
      : this.getWorkspaceById(workspace.id)?.isOpen
        ? workspace.id
        : undefined;

    if (isNewWorkspace) {
      workspace.id = IdCreator.newWorkspaceId();
      workspace.position = this._workspaceList().filter(
        (workspaceEntry) => workspaceEntry.id !== DEFAULT_WORKSPACE_ID,
      ).length;
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

    this.persistedWorkspaceRuntimeSignatureById.set(
      workspace.id,
      this.createWorkspaceRuntimeSignature(workspace.tabs, workspace.grids),
    );

    return workspace.id;
  }

  private refreshDirtyStateForActiveWorkspace(): void {
    this.refreshDirtyStateForWorkspace(this.getActiveWorkspace()?.id);
  }

  private refreshDirtyStateForWorkspace(workspaceId: string | undefined): void {
    if (!workspaceId || workspaceId === DEFAULT_WORKSPACE_ID) {
      return;
    }

    const persistedSignature = this.persistedWorkspaceRuntimeSignatureById.get(workspaceId);
    const currentSignature = this.createWorkspaceRuntimeSignature(
      this.tabListService.getTabConfigs(workspaceId),
      this.gridListService.getGridConfigs(workspaceId),
    );

    this.setWorkspaceDirtyState(workspaceId, persistedSignature !== currentSignature);
  }

  private setWorkspaceDirtyState(workspaceId: string, isDirty: boolean): void {
    const currentWorkspaceList = this._workspaceList();
    const workspaceIndex = currentWorkspaceList.findIndex(
      (workspaceEntry) => workspaceEntry.id === workspaceId,
    );
    if (workspaceIndex === -1 || currentWorkspaceList[workspaceIndex].isDirty === isDirty) {
      return;
    }

    const nextWorkspaceList = [...currentWorkspaceList];
    nextWorkspaceList[workspaceIndex] = {
      ...nextWorkspaceList[workspaceIndex],
      isDirty,
    };
    this._workspaceList.set(nextWorkspaceList);
  }

  private createWorkspaceRuntimeSignature(
    tabs: WorkspaceConfiguration["tabs"],
    grids: WorkspaceConfiguration["grids"],
  ): string {
    const signature: DirtyTrackingWorkspaceSignature = {
      tabs: tabs.map((tab) => ({ tabId: tab.tabId })),
      grids: grids.map((grid) => ({
        tabId: grid.tabId,
        pane: this.createDirtyTrackingPaneSignature(grid.pane),
      })),
    };
    return JSON.stringify(signature);
  }

  private createDirtyTrackingPaneSignature(
    pane: PersistedPaneConfigurationContract,
  ): DirtyTrackingPaneSignature {
    if (pane.splitDirection) {
      return {
        splitDirection: pane.splitDirection,
        ratio: pane.ratio,
        leftChild: pane.leftChild
          ? this.createDirtyTrackingPaneSignature(pane.leftChild)
          : undefined,
        rightChild: pane.rightChild
          ? this.createDirtyTrackingPaneSignature(pane.rightChild)
          : undefined,
      };
    }

    return {
      shellName: pane.shellName,
      workingDir: pane.workingDir,
    };
  }

  private async runWithoutDirtyTracking<T>(callback: () => Promise<T>): Promise<T> {
    this.synchronizingWorkspaceRuntimeDepth += 1;
    try {
      return await callback();
    } finally {
      this.synchronizingWorkspaceRuntimeDepth -= 1;
    }
  }
}
