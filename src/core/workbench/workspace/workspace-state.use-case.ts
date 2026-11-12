import { GridConfig, PaneConfig, TabConfig } from "@cogno/core/workbench/grid-layout";
import { WorkspaceConfiguration, WorkspaceState } from "./workspace.model";
import { defaultWorkspaceIdContract } from "./workspace-entry";

export interface WorkspaceActivationPlan {
  readonly shouldRestoreRuntime: boolean;
  readonly workspaceList: WorkspaceState[];
  readonly workspaceToActivate?: WorkspaceState;
}

export interface WorkspaceClosePlan {
  /** Unset when there was nothing to close: unknown, the default or not open. */
  readonly closedWorkspace?: WorkspaceState;
  readonly workspaceList: WorkspaceState[];
  readonly workspaceToActivateId?: string;
}

export interface WorkspaceDeletePlan {
  readonly deletedWorkspace?: WorkspaceState;
  readonly workspaceList: WorkspaceState[];
  readonly workspaceToActivateId?: string;
}

export interface WorkspaceUpsertPlan {
  readonly wasExisting: boolean;
  readonly workspaceEntry?: WorkspaceState;
  readonly workspaceList: WorkspaceState[];
}

export interface ShellAdoptionPlan {
  /** The workspaces to start with, the default one among them when it took shells in. */
  readonly workspaces: WorkspaceConfiguration[];
  /** The tabs the default workspace got, one per shell; empty when no shell was left over. */
  readonly adoptedTabIds: string[];
}

function terminalIdsOf(pane: PaneConfig | undefined): string[] {
  if (!pane) return [];
  return [
    ...(pane.terminalId ? [pane.terminalId] : []),
    ...terminalIdsOf(pane.leftChild),
    ...terminalIdsOf(pane.rightChild),
  ];
}

export class WorkspaceStateUseCase {
  /**
   * Gives every running shell that no saved workspace has a pane for a tab in
   * the default workspace, so it can be reached again. A shell that belongs
   * to a workspace is left to that workspace, open or not: its pane shows it
   * once the workspace is opened. The other workspaces are never touched.
   */
  static adoptLeftOverShells(
    workspaces: ReadonlyArray<WorkspaceConfiguration>,
    defaultWorkspace: WorkspaceConfiguration,
    runningTerminalIds: ReadonlyArray<string>,
    newTabId: () => string,
  ): ShellAdoptionPlan {
    const placed = new Set(
      workspaces.flatMap((workspace) =>
        workspace.grids.flatMap((grid) => terminalIdsOf(grid.pane)),
      ),
    );
    const leftOver = runningTerminalIds.filter((terminalId) => !placed.has(terminalId));
    if (leftOver.length === 0) {
      return { workspaces: [...workspaces], adoptedTabIds: [] };
    }
    const adopted = leftOver.map((terminalId) => ({ tabId: newTabId(), terminalId }));
    const adopting =
      workspaces.find((workspace) => workspace.id === defaultWorkspace.id) ?? defaultWorkspace;
    const withShells: WorkspaceConfiguration = {
      ...adopting,
      tabs: [...adopting.tabs, ...adopted.map(({ tabId }) => ({ tabId }))],
      grids: [
        ...adopting.grids,
        ...adopted.map(({ tabId, terminalId }) => ({ tabId, pane: { terminalId } })),
      ],
      // Its panes have to exist for the shells to be shown, whichever
      // workspace is in front.
      isOpen: true,
    };
    return {
      workspaces: [
        withShells,
        ...workspaces.filter((workspace) => workspace.id !== defaultWorkspace.id),
      ],
      adoptedTabIds: adopted.map(({ tabId }) => tabId),
    };
  }

  static createDefaultWorkspace(defaultWorkspaceId: string, tabId: string): WorkspaceConfiguration {
    return {
      id: defaultWorkspaceId,
      name: "Default Workspace",
      color: "grey",
      grids: [{ tabId, pane: {} }],
      tabs: [{ tabId }],
      stacks: [],
    };
  }

  static createInitialWorkspaceState(
    persistedWorkspaces: ReadonlyArray<WorkspaceConfiguration>,
    defaultWorkspace: WorkspaceConfiguration,
  ): WorkspaceState[] {
    // The default workspace always exists and is first. If it was persisted
    // (session restore), use the persisted one (with its layout); otherwise the
    // fresh in-memory default. Either way it never appears twice.
    const persistedDefault = persistedWorkspaces.find(
      (workspace) => workspace.id === defaultWorkspace.id,
    );
    const others = persistedWorkspaces.filter((workspace) => workspace.id !== defaultWorkspace.id);
    const workspaceList = [persistedDefault ?? defaultWorkspace, ...others].map(
      (workspaceConfiguration) => ({
        ...workspaceConfiguration,
        isActive: workspaceConfiguration.isActive ?? false,
        isOpen: false,
      }),
    );

    if (!workspaceList.find((workspace) => workspace.isActive) && workspaceList[0]) {
      workspaceList[0] = { ...workspaceList[0], isActive: true };
    }

    return workspaceList;
  }

  static activateWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspaceId: string,
  ): WorkspaceActivationPlan {
    const workspaceToActivate = WorkspaceStateUseCase.getWorkspaceById(workspaceList, workspaceId);

    if (!workspaceToActivate) {
      return {
        shouldRestoreRuntime: false,
        workspaceList: [...workspaceList],
      };
    }

    const shouldRestoreRuntime = !workspaceToActivate.isOpen;
    const nextWorkspaceList: WorkspaceState[] = workspaceList.map((workspaceEntry) => ({
      ...workspaceEntry,
      isActive: workspaceEntry.id === workspaceId,
      isOpen: workspaceEntry.id === workspaceId ? true : workspaceEntry.isOpen,
    }));
    const nextWorkspace = WorkspaceStateUseCase.getWorkspaceById(nextWorkspaceList, workspaceId);

    return {
      shouldRestoreRuntime,
      workspaceList: nextWorkspaceList,
      workspaceToActivate: nextWorkspace,
    };
  }

  static createWorkspaceDraft(tabId: string): WorkspaceState {
    const paneConfiguration: GridConfig = { tabId, pane: {} };
    const tabConfiguration: TabConfig = { tabId };

    return {
      id: "",
      name: "",
      color: undefined,
      grids: [paneConfiguration],
      tabs: [tabConfiguration],
      stacks: [],
      isActive: true,
      isOpen: false,
    };
  }

  /**
   * Update a workspace in place, or add a new one selected but not open: the
   * caller activates it, which builds its runtime from the given layout. The
   * workspace that was active keeps running - its sessions are its own.
   */
  static upsertWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspace: WorkspaceConfiguration,
  ): WorkspaceUpsertPlan {
    const existingWorkspaceIndex = workspaceList.findIndex(
      (workspaceEntry) =>
        workspaceEntry.id === workspace.id ||
        (workspace.id === "" && workspaceEntry.name === workspace.name),
    );

    if (existingWorkspaceIndex >= 0) {
      const nextWorkspaceList = [...workspaceList];
      nextWorkspaceList[existingWorkspaceIndex] = {
        ...workspace,
        isActive: nextWorkspaceList[existingWorkspaceIndex].isActive,
        isOpen: nextWorkspaceList[existingWorkspaceIndex].isOpen,
      };
      return {
        wasExisting: true,
        workspaceEntry: nextWorkspaceList[existingWorkspaceIndex],
        workspaceList: nextWorkspaceList,
      };
    }

    const nextWorkspaceList: WorkspaceState[] = workspaceList.map((workspaceEntry) => ({
      ...workspaceEntry,
      isActive: false,
    }));
    const workspacePosition = nextWorkspaceList.filter(
      (workspaceEntry) => workspaceEntry.id !== defaultWorkspaceIdContract,
    ).length;
    const workspaceEntry: WorkspaceState = {
      ...workspace,
      position: workspace.position ?? workspacePosition,
      isActive: true,
      isOpen: false,
    };

    nextWorkspaceList.push(workspaceEntry);
    return {
      wasExisting: false,
      workspaceEntry,
      workspaceList: nextWorkspaceList,
    };
  }

  static reorderWorkspaces(
    workspaceList: ReadonlyArray<WorkspaceState>,
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
  ): WorkspaceState[] {
    if (
      sourceWorkspaceId === defaultWorkspaceIdContract ||
      targetWorkspaceId === defaultWorkspaceIdContract ||
      sourceWorkspaceId === targetWorkspaceId
    ) {
      return [...workspaceList];
    }

    const nextWorkspaceList = [...workspaceList];
    const sourceWorkspaceIndex = nextWorkspaceList.findIndex(
      (workspace) => workspace.id === sourceWorkspaceId,
    );
    const targetWorkspaceIndex = nextWorkspaceList.findIndex(
      (workspace) => workspace.id === targetWorkspaceId,
    );

    if (sourceWorkspaceIndex < 0 || targetWorkspaceIndex < 0) {
      return nextWorkspaceList;
    }

    const [sourceWorkspace] = nextWorkspaceList.splice(sourceWorkspaceIndex, 1);
    nextWorkspaceList.splice(targetWorkspaceIndex, 0, sourceWorkspace);

    let position = 0;
    return nextWorkspaceList.map((workspace) => {
      if (workspace.id === defaultWorkspaceIdContract) {
        return workspace;
      }
      const nextWorkspace = {
        ...workspace,
        position,
      };
      position += 1;
      return nextWorkspace;
    });
  }

  static closeWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspaceId: string,
  ): WorkspaceClosePlan {
    const workspaceToClose = WorkspaceStateUseCase.getWorkspaceById(workspaceList, workspaceId);
    if (
      !workspaceToClose ||
      workspaceToClose.id === defaultWorkspaceIdContract ||
      !workspaceToClose.isOpen
    ) {
      return { workspaceList: [...workspaceList] };
    }

    const nextWorkspaceList: WorkspaceState[] = workspaceList.map((workspaceEntry) =>
      workspaceEntry.id !== workspaceId
        ? { ...workspaceEntry }
        : {
            ...workspaceEntry,
            isOpen: false,
            isActive: false,
          },
    );

    if (workspaceToClose.isActive) {
      const fallbackWorkspace =
        nextWorkspaceList.find((workspaceEntry) => workspaceEntry.isOpen) ??
        nextWorkspaceList.find(
          (workspaceEntry) => workspaceEntry.id === defaultWorkspaceIdContract,
        );
      return {
        closedWorkspace: workspaceToClose,
        workspaceList: nextWorkspaceList,
        workspaceToActivateId: fallbackWorkspace?.id,
      };
    }

    return {
      closedWorkspace: workspaceToClose,
      workspaceList: nextWorkspaceList,
    };
  }

  static deleteWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspaceId: string,
  ): WorkspaceDeletePlan {
    const workspaceIndex = workspaceList.findIndex((workspace) => workspace.id === workspaceId);
    if (workspaceIndex === -1) {
      throw new Error("Workspace id not found");
    }

    const deletedWorkspace = workspaceList[workspaceIndex];
    const nextWorkspaceList: WorkspaceState[] = workspaceList
      .filter((workspace) => workspace.id !== workspaceId)
      .map((workspace) => ({ ...workspace }));

    const workspaceToActivateId = deletedWorkspace.isActive ? nextWorkspaceList[0]?.id : undefined;
    return {
      deletedWorkspace,
      workspaceList: nextWorkspaceList,
      workspaceToActivateId,
    };
  }

  static getWorkspaceById(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspaceId: string,
  ): WorkspaceState | undefined {
    return workspaceList.find((workspace) => workspace.id === workspaceId);
  }

  static getActiveWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
  ): WorkspaceState | undefined {
    return workspaceList.find((workspace) => workspace.isActive);
  }
}
