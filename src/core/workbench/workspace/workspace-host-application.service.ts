import { computed, DestroyRef, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { defaultWorkspaceIdContract, WorkspaceEntryContract } from "@cogno/shared/domain";
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

type PaneConfig = WorkspaceConfiguration["grids"][number]["pane"];

/** The pane tree with `mapLeaf` applied to every leaf (a pane with no children). */
function mapPaneLeaves(pane: PaneConfig, mapLeaf: (leaf: PaneConfig) => PaneConfig): PaneConfig {
  const { leftChild, rightChild, ...rest } = pane;
  if (!leftChild && !rightChild) {
    return mapLeaf(rest);
  }
  return {
    ...rest,
    ...(leftChild ? { leftChild: mapPaneLeaves(leftChild, mapLeaf) } : {}),
    ...(rightChild ? { rightChild: mapPaneLeaves(rightChild, mapLeaf) } : {}),
  };
}

/** The pane tree without its terminal ids: every leaf opens a new shell. */
function withoutTerminalIds(pane: PaneConfig): PaneConfig {
  return mapPaneLeaves(pane, ({ terminalId: _terminalId, ...leaf }) => leaf);
}

/** Idle time after terminal output before an auto-save of the active workspace. */
const IDLE_AUTOSAVE_MS = 2500;

/**
 * What makes a workspace "dirty" when it changes: the tabs' identity, colour and
 * user title, and the panes' layout, shell and directory. Everything else (active
 * flags, system titles, terminal ids) changes without the user having edited it.
 */
const DIRTY_TRACKED_KEYS = [
  "tabs",
  "grids",
  "tabId",
  "color",
  "userTitle",
  "pane",
  "splitDirection",
  "ratio",
  "leftChild",
  "rightChild",
  "shellName",
  "workingDir",
];

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
  /** The workspaces as the panel, the header and the shortcuts list them. */
  readonly workspaceEntries: Signal<ReadonlyArray<WorkspaceEntryContract>> = computed(() =>
    this._workspaceList().map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      isDirty: workspace.isDirty,
      isActive: workspace.isActive,
      isOpen: workspace.isOpen,
      autoSaveStatus: workspace.autoSaveStatus,
      autoSavedAt: workspace.autoSavedAt,
    })),
  );

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
      const workspaces = this.workspacesToStartWith(
        await this.workspaceRepository.getAllWorkspaces(),
      );
      await this.repairDuplicateIds(workspaces);
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

      // Put back what the user had: every workspace that was open gets its
      // runtime again, in the background; the one that was active comes to
      // the front last.
      const activeWorkspace = WorkspaceStateUseCase.getActiveWorkspace(workspaceList);
      await this.runWithoutDirtyTracking(async () => {
        for (const workspace of workspaces) {
          if (workspace.isOpen && workspace.id !== activeWorkspace?.id) {
            this.openInBackground(workspace);
          }
        }
      });
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

  /** Persist every open workspace, for the quit hook (step 27e). */
  async persistOpenWorkspaces(): Promise<void> {
    await Promise.all(
      this._workspaceList()
        .filter((workspace) => workspace.isOpen)
        .map((workspace) => this.autoPersistWorkspace(workspace.id)),
    );
  }

  /** Build a workspace's runtime without showing it; its sessions run behind the active one. */
  private openInBackground(workspace: WorkspaceConfiguration): void {
    this.tabListService.restoreTabs(workspace.tabs, workspace.id);
    this.gridListService.restoreGridsForWorkspace(workspace.grids, workspace.id);
    this._workspaceList.update((workspaceList) =>
      workspaceList.map((entry) =>
        entry.id === workspace.id ? { ...entry, isOpen: true } : entry,
      ),
    );
  }

  private get isRestoreEnabled(): boolean {
    return this.configService.config.terminal?.restore?.enabled !== false;
  }

  /**
   * With session restore off a launch brings nothing back: no workspace is
   * reopened and the default workspace starts fresh. The saved workspaces stay
   * in the list, to be opened by hand from their last explicit save.
   */
  private workspacesToStartWith(
    persistedWorkspaces: WorkspaceConfiguration[],
  ): WorkspaceConfiguration[] {
    if (this.isRestoreEnabled) {
      return persistedWorkspaces;
    }
    return persistedWorkspaces
      .filter((workspace) => workspace.id !== this.defaultWorkspace.id)
      .map((workspace) => ({ ...workspace, isOpen: false, isActive: false }));
  }

  /** Record which workspaces are open and which is active, for the next launch. */
  private async persistOpenState(): Promise<void> {
    if (!this.isRestoreEnabled) {
      return;
    }
    const workspaceList = this._workspaceList();
    await this.workspaceRepository.saveOpenState(
      workspaceList.filter((workspace) => workspace.isOpen).map((workspace) => workspace.id),
      workspaceList.find((workspace) => workspace.isActive)?.id,
    );
  }

  /**
   * Record every live session's running command as aborted before exit (step
   * 27b-2). Separate from persistOpenWorkspaces: the command log persists
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
      await this.persistOpenState();

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

    const workspaceId = await this.persistWorkspaceConfiguration(workspace);

    await this.runWithoutDirtyTracking(async () => {
      const upsertPlan = WorkspaceStateUseCase.upsertWorkspace(this._workspaceList(), workspace);

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
    if (!this.isRestoreEnabled) {
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
      await this.activateWorkspaceById(deletePlan.workspaceToActivateId);
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
      await this.activateWorkspaceById(closePlan.workspaceToActivateId);
      await this.persistOpenState();
    });
  }

  private async activateWorkspaceById(id: string | undefined): Promise<void> {
    const workspace = id ? this.getWorkspaceById(id) : undefined;
    if (workspace) {
      await this.activateWorkspace(workspace);
    }
  }

  async restoreWorkspaceById(id: string): Promise<void> {
    const workspace = this.getWorkspaceById(id);
    if (workspace) {
      await this.restoreWorkspace(workspace);
    }
  }

  getWorkspaceById(id: string): WorkspaceState | undefined {
    return WorkspaceStateUseCase.getWorkspaceById(this._workspaceList(), id);
  }

  getActiveWorkspace(): WorkspaceState | undefined {
    return WorkspaceStateUseCase.getActiveWorkspace(this._workspaceList());
  }

  /**
   * Tab and terminal ids are global: a tab id names one tab and a terminal id
   * one session, across all workspaces (busy animations, sessions and snapshots
   * are keyed by the bare id). Older versions moved a workspace's runtime into
   * a new workspace while the old one kept the same layout, so a persisted id
   * could sit in two workspaces. Repair such data on startup: every but the
   * first occurrence gets a fresh id, and a reassigned terminal's snapshot is
   * dropped - it belongs to the workspace that kept the id.
   */
  private async repairDuplicateIds(workspaces: WorkspaceConfiguration[]): Promise<void> {
    const seenTabIds = new Set<string>();
    const seenTerminalIds = new Set<string>();

    for (const workspace of workspaces) {
      const remappedTabIds = new Map<string, string>();
      const orphanedTerminalIds: string[] = [];

      for (const tab of workspace.tabs) {
        if (seenTabIds.has(tab.tabId)) {
          remappedTabIds.set(tab.tabId, IdCreator.newTabId());
        } else {
          seenTabIds.add(tab.tabId);
        }
      }
      const grids = workspace.grids.map((grid) => ({
        tabId: remappedTabIds.get(grid.tabId) ?? grid.tabId,
        pane: mapPaneLeaves(grid.pane, (leaf) => {
          if (!leaf.terminalId || !seenTerminalIds.has(leaf.terminalId)) {
            if (leaf.terminalId) seenTerminalIds.add(leaf.terminalId);
            return leaf;
          }
          orphanedTerminalIds.push(leaf.terminalId);
          return { ...leaf, terminalId: IdCreator.newTerminalId() };
        }),
      }));

      if (remappedTabIds.size === 0 && orphanedTerminalIds.length === 0) continue;

      workspace.tabs = workspace.tabs.map((tab) => ({
        ...tab,
        tabId: remappedTabIds.get(tab.tabId) ?? tab.tabId,
      }));
      workspace.grids = grids;
      for (const newTabId of remappedTabIds.values()) {
        seenTabIds.add(newTabId);
      }

      await this.workspaceRepository.updateWorkspace(workspace);
      for (const terminalId of orphanedTerminalIds) {
        await this.workspaceRepository.deleteTerminalSession(workspace.id, terminalId);
      }
    }
  }

  /**
   * A new workspace starts as a copy of the active workspace's layout - the
   * tabs, splits and directories, under fresh tab ids and without terminal ids,
   * so activating it opens new shells there. The active workspace keeps its
   * sessions: a terminal id names one session in one workspace, never two.
   */
  private async persistWorkspaceConfiguration(workspace: WorkspaceConfiguration): Promise<string> {
    const isNewWorkspace = workspace.id === "";
    const sourceWorkspaceId = isNewWorkspace
      ? this.getActiveWorkspace()?.id
      : this.getWorkspaceById(workspace.id)?.isOpen
        ? workspace.id
        : undefined;

    if (sourceWorkspaceId) {
      workspace.grids = this.gridListService.getGridConfigs(sourceWorkspaceId);
      workspace.tabs = this.tabListService.getTabConfigs(sourceWorkspaceId);
    }

    if (isNewWorkspace) {
      workspace.id = IdCreator.newWorkspaceId();
      workspace.position = this._workspaceList().filter(
        (workspaceEntry) => workspaceEntry.id !== DEFAULT_WORKSPACE_ID,
      ).length;
      const freshTabIds = new Map(workspace.tabs.map((tab) => [tab.tabId, IdCreator.newTabId()]));
      workspace.tabs = workspace.tabs.map((tab) => ({
        ...tab,
        tabId: freshTabIds.get(tab.tabId) ?? tab.tabId,
      }));
      workspace.grids = workspace.grids.map((grid) => ({
        tabId: freshTabIds.get(grid.tabId) ?? grid.tabId,
        pane: withoutTerminalIds(grid.pane),
      }));
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
    // Keep the last saved time while a new save is in flight or on failure.
    this.patchWorkspace(workspaceId, {
      autoSaveStatus: status,
      ...(status === "saved" ? { autoSavedAt: at } : {}),
    });
  }

  private setWorkspaceDirtyState(workspaceId: string, isDirty: boolean): void {
    this.patchWorkspace(workspaceId, { isDirty });
  }

  /** Writes `patch` into the workspace; a patch that changes nothing emits nothing. */
  private patchWorkspace(workspaceId: string, patch: Partial<WorkspaceState>): void {
    const workspace = this.getWorkspaceById(workspaceId);
    const changes = Object.entries(patch) as [keyof WorkspaceState, unknown][];
    if (!workspace || changes.every(([key, value]) => workspace[key] === value)) {
      return;
    }
    this._workspaceList.update((workspaceList) =>
      workspaceList.map((entry) => (entry.id === workspaceId ? { ...entry, ...patch } : entry)),
    );
  }

  private createWorkspaceRuntimeSignature(
    tabs: WorkspaceConfiguration["tabs"],
    grids: WorkspaceConfiguration["grids"],
  ): string {
    return JSON.stringify({ tabs, grids }, DIRTY_TRACKED_KEYS);
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
