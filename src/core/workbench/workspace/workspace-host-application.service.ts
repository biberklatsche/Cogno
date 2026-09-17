import { DestroyRef, Injectable, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import {
  defaultWorkspaceIdContract,
  PersistedPaneConfigurationContract,
} from "@cogno/shared/domain";
import {
  WorkspaceAutoSaveStatus,
  WorkspaceConfiguration,
  WorkspaceState,
  WorkspaceStateUseCase,
} from "@cogno/shared/domain/workspace";
import { Color, IdCreator } from "@cogno/shared/support";
import { debounceTime, filter, merge } from "rxjs";
import { SessionPersistenceService } from "./session-persistence.service";
import { WorkspaceRepository } from "./workspace.repository";

const DEFAULT_WORKSPACE_ID = defaultWorkspaceIdContract;

/** Idle time after terminal output before an auto-save of the active workspace. */
const IDLE_AUTOSAVE_MS = 2500;

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
    readonly color?: string;
    readonly userTitle?: string;
  }>;
  readonly grids: ReadonlyArray<{
    readonly tabId: string;
    readonly pane: DirtyTrackingPaneSignature;
  }>;
}

@Injectable({ providedIn: "root" })
export class WorkspaceHostApplicationService {
  private readonly defaultWorkspace = WorkspaceStateUseCase.createDefaultWorkspace(
    DEFAULT_WORKSPACE_ID,
    IdCreator.newTabId(),
  );
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
    private readonly configService: ConfigService,
    private readonly sessionPersistence: SessionPersistenceService,
    sessionRegistry: TerminalSessionRegistry,
    destroyRef: DestroyRef,
  ) {
    this.bus.once$("DBInitialized").subscribe(async () => {
      const workspaces = await this.workspaceRepository.getAllWorkspaces();
      await this.repairDuplicateTabIds(workspaces);
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

      // Load saved scrollback into the pending store before any session spawns,
      // so the factory can replay it as terminals are (re)created (step 27f).
      await this.sessionPersistence.loadPendingSnapshots(
        workspaceList.map((workspace) => workspace.id),
      );

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

    // Idle auto-save: a few seconds after terminal output settles, persist the
    // active workspace so a crash loses at most that window (step 27e).
    sessionRegistry.facts$
      .pipe(
        filter(({ fact }) => fact.type === "outputReceived"),
        debounceTime(IDLE_AUTOSAVE_MS),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        const active = this.getActiveWorkspace();
        if (active) {
          void this.autoPersistWorkspace(active.id);
        }
      });
  }

  public async restoreWorkspace(workspace: WorkspaceState): Promise<void> {
    // Switching workspaces: persist the one we are leaving first (autosave).
    const outgoing = this.getActiveWorkspace();
    if (outgoing && outgoing.id !== workspace.id) {
      await this.autoPersistWorkspace(outgoing.id);
    }
    await this.activateWorkspace(workspace);
  }

  /** Persist the currently active workspace (for the quit hook, step 27e). */
  async persistActiveWorkspace(): Promise<void> {
    const active = this.getActiveWorkspace();
    if (active) {
      await this.autoPersistWorkspace(active.id);
    }
  }

  /**
   * Record every live session's running command as aborted before exit (step
   * 27b-2). Separate from persistActiveWorkspace: the command log persists
   * regardless of the session-restore setting.
   */
  async recordAbortedCommands(): Promise<void> {
    await this.sessionPersistence.recordAbortedCommands();
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
      const fallbackTab = activeTab ?? this.tabListService.getTabConfigs(workspaceToActivate.id)[0];
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

  /**
   * Auto-persist a workspace's live layout + terminal snapshots for session
   * restore (step 27). Unlike the explicit `saveWorkspace`, this includes the
   * default workspace. No-op when restore is off. Layout and snapshots are two
   * atomic batches; each collects its data before writing.
   */
  async autoPersistWorkspace(workspaceId: string): Promise<void> {
    if (this.configService.config.terminal?.restore?.enabled === false) {
      return;
    }
    const workspace = this.getWorkspaceById(workspaceId);
    if (!workspace) {
      return;
    }
    this.setWorkspaceAutoSaveStatus(workspaceId, "saving");
    try {
      await this.workspaceRepository.upsertWorkspace({
        id: workspace.id,
        name: workspace.name,
        color: workspace.color,
        position: workspace.position,
        isActive: workspace.isActive,
        grids: this.gridListService.getGridConfigs(workspaceId),
        tabs: this.tabListService.getTabConfigs(workspaceId),
      });
      await this.sessionPersistence.persistWorkspace(workspaceId);
    } catch (error) {
      this.setWorkspaceAutoSaveStatus(workspaceId, undefined);
      throw error;
    }
    this.setWorkspaceAutoSaveStatus(workspaceId, "saved", Date.now());
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

  getActiveWorkspace(): WorkspaceState | undefined {
    return WorkspaceStateUseCase.getActiveWorkspace(this._workspaceList());
  }

  /**
   * Tab IDs must be globally unique (e.g. `BusyIndicatorService` matches animations to tabs by
   * ID alone, across all workspaces). Older versions could persist the same tab ID into multiple
   * workspaces (e.g. via "save as new workspace" while the default workspace's "TB_DEFAULT" tab
   * was active). Detect and repair such collisions on startup by reassigning fresh IDs to every
   * but the first occurrence of a tab ID.
   */
  private async repairDuplicateTabIds(workspaces: WorkspaceConfiguration[]): Promise<void> {
    const seenTabIds = new Set<string>();

    for (const workspace of workspaces) {
      const remappedTabIds = new Map<string, string>();

      for (const tab of workspace.tabs) {
        if (seenTabIds.has(tab.tabId)) {
          remappedTabIds.set(tab.tabId, IdCreator.newTabId());
        } else {
          seenTabIds.add(tab.tabId);
        }
      }

      if (remappedTabIds.size === 0) continue;

      workspace.tabs = workspace.tabs.map((tab) => ({
        ...tab,
        tabId: remappedTabIds.get(tab.tabId) ?? tab.tabId,
      }));
      workspace.grids = workspace.grids.map((grid) => ({
        ...grid,
        tabId: remappedTabIds.get(grid.tabId) ?? grid.tabId,
      }));
      for (const newTabId of remappedTabIds.values()) {
        seenTabIds.add(newTabId);
      }

      await this.workspaceRepository.updateWorkspace(workspace);
    }
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

  private setWorkspaceAutoSaveStatus(
    workspaceId: string,
    status: WorkspaceAutoSaveStatus | undefined,
    at?: number,
  ): void {
    const currentWorkspaceList = this._workspaceList();
    const workspaceIndex = currentWorkspaceList.findIndex(
      (workspaceEntry) => workspaceEntry.id === workspaceId,
    );
    if (workspaceIndex === -1) {
      return;
    }
    const nextWorkspaceList = [...currentWorkspaceList];
    nextWorkspaceList[workspaceIndex] = {
      ...nextWorkspaceList[workspaceIndex],
      autoSaveStatus: status,
      // Keep the last saved time while a new save is in flight or on failure.
      autoSavedAt: status === "saved" ? at : nextWorkspaceList[workspaceIndex].autoSavedAt,
    };
    this._workspaceList.set(nextWorkspaceList);
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
      tabs: tabs.map((tab) => ({ tabId: tab.tabId, color: tab.color, userTitle: tab.userTitle })),
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
