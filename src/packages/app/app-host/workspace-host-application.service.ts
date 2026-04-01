import { DestroyRef, Injectable, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { defaultWorkspaceIdContract } from "@cogno/core-api";
import {
  WorkspaceConfiguration,
  WorkspaceState,
  WorkspaceStateUseCase,
} from "@cogno/core-domain/workspace";
import { AppBus } from "../app-bus/app-bus";
import { IdCreator } from "../common/id-creator/id-creator";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { TabListService } from "../tab-list/+state/tab-list.service";
import { Color } from "../common/color/color";
import { ActionFired } from "../action/action.models";
import { WorkspaceRepository } from "./workspace.repository";

export type WorkspaceConfigUi = WorkspaceState;

export const DEFAULT_WORKSPACE_ID = defaultWorkspaceIdContract;

@Injectable({ providedIn: "root" })
export class WorkspaceHostApplicationService {
  private readonly defaultWorkspace = WorkspaceStateUseCase.createDefaultWorkspace(DEFAULT_WORKSPACE_ID);

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
      const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
        workspaces,
        this.defaultWorkspace,
      );

      this._workspaceList.set(workspaceList);

      const activeWorkspace = WorkspaceStateUseCase.getActiveWorkspace(workspaceList);
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
    const activationPlan = WorkspaceStateUseCase.activateWorkspace(this._workspaceList(), workspace.id);
    const previousActiveWorkspace = activationPlan.previousActiveWorkspace;
    const workspaceToActivate = activationPlan.workspaceToActivate;

    if (!workspaceToActivate) {
      return;
    }

    if (
      previousActiveWorkspace
      && previousActiveWorkspace.id !== workspaceToActivate.id
      && previousActiveWorkspace.autosave
    ) {
      await this.saveWorkspace(previousActiveWorkspace);
    }

    if (activationPlan.shouldRestoreRuntime) {
      this.tabListService.restoreTabs(workspaceToActivate.tabs, workspaceToActivate.id);
      this.gridListService.restoreGridsForWorkspace(workspaceToActivate.grids, workspaceToActivate.id);
    }

    this.tabListService.activateWorkspace(workspaceToActivate.id);
    this.gridListService.activateWorkspace(workspaceToActivate.id);

    const activeTab = this.tabListService.getTabConfigs(workspaceToActivate.id).find((tabConfiguration) => tabConfiguration.isActive);
    const fallbackTab = activeTab ?? this.tabListService.getTabConfigs(workspaceToActivate.id)[0];
    if (fallbackTab) {
      this.tabListService.selectTab(fallbackTab.tabId);
    }

    this._workspaceList.set(activationPlan.workspaceList);

    if (workspaceToActivate.id === DEFAULT_WORKSPACE_ID) {
      this.sideMenuService.updateBadgeColor("Workspace", undefined);
      return;
    }

    this.sideMenuService.updateBadgeColor("Workspace", workspaceToActivate.color);
  }

  createWorkspaceDraft(): WorkspaceConfigUi {
    return WorkspaceStateUseCase.createWorkspaceDraft(IdCreator.newTabId());
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

    const upsertPlan = WorkspaceStateUseCase.upsertWorkspace(
      this._workspaceList(),
      workspace,
      previousActiveWorkspace?.id,
    );

    this._workspaceList.set(upsertPlan.workspaceList);
    if (upsertPlan.wasExisting) {
      return workspaceId;
    }

    if (upsertPlan.workspaceEntry) {
      await this.activateWorkspace(upsertPlan.workspaceEntry);
    }
    return workspaceId;
  }

  async reorderWorkspaces(sourceWorkspaceId: string, targetWorkspaceId: string): Promise<void> {
    this._workspaceList.set(
      WorkspaceStateUseCase.reorderWorkspaces(this._workspaceList(), sourceWorkspaceId, targetWorkspaceId),
    );
  }

  async persistWorkspaceOrder(): Promise<void> {
    const persistedWorkspaceList = this._workspaceList().filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID);
    await this.workspaceRepository.reorderWorkspaces(persistedWorkspaceList.map((workspace) => workspace.id));
  }

  async deleteWorkspace(id: string): Promise<void> {
    const deletePlan = WorkspaceStateUseCase.deleteWorkspace(this._workspaceList(), id);
    await this.workspaceRepository.deleteWorkspace(id);

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
  }

  async closeWorkspace(id: string): Promise<void> {
    const closePlan = WorkspaceStateUseCase.closeWorkspace(this._workspaceList(), id);
    const workspaceToClose = closePlan.closedWorkspace;
    if (!workspaceToClose || workspaceToClose.id === DEFAULT_WORKSPACE_ID || !workspaceToClose.isOpen) {
      return;
    }

    if (workspaceToClose.autosave) {
      await this.saveWorkspace(workspaceToClose);
    }

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
  }

  getWorkspaceById(id: string): WorkspaceConfigUi | undefined {
    return WorkspaceStateUseCase.getWorkspaceById(this._workspaceList(), id);
  }

  private getActiveWorkspace(): WorkspaceConfigUi | undefined {
    return WorkspaceStateUseCase.getActiveWorkspace(this._workspaceList());
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
