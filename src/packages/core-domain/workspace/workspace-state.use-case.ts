import { defaultWorkspaceIdContract, GridConfig, TabConfig } from "@cogno/core-api";
import { WorkspaceConfiguration, WorkspaceState } from "./workspace.model";

export interface WorkspaceActivationPlan {
  readonly previousActiveWorkspace?: WorkspaceState;
  readonly shouldRestoreRuntime: boolean;
  readonly workspaceList: WorkspaceState[];
  readonly workspaceToActivate?: WorkspaceState;
}

export interface WorkspaceClosePlan {
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

export class WorkspaceStateUseCase {
  static createDefaultWorkspace(
    defaultWorkspaceId: string = defaultWorkspaceIdContract,
  ): WorkspaceConfiguration {
    return {
      id: defaultWorkspaceId,
      name: "Default Workspace",
      color: "grey",
      grids: [{ tabId: "TB_DEFAULT", pane: {} }],
      tabs: [{ tabId: "TB_DEFAULT" }],
    };
  }

  static createInitialWorkspaceState(
    persistedWorkspaces: ReadonlyArray<WorkspaceConfiguration>,
    defaultWorkspace: WorkspaceConfiguration = WorkspaceStateUseCase.createDefaultWorkspace(),
  ): WorkspaceState[] {
    const workspaceList = [defaultWorkspace, ...persistedWorkspaces].map(
      (workspaceConfiguration) => ({
        ...workspaceConfiguration,
        isSelected: workspaceConfiguration.isActive ?? false,
        isOpen: false,
      }),
    );

    if (!workspaceList.find((workspace) => workspace.isSelected) && workspaceList[0]) {
      workspaceList[0] = {
        ...workspaceList[0],
        isSelected: true,
        isActive: true,
      };
    }

    return workspaceList;
  }

  static activateWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspaceId: string,
  ): WorkspaceActivationPlan {
    const previousActiveWorkspace = WorkspaceStateUseCase.getActiveWorkspace(workspaceList);
    const workspaceToActivate = WorkspaceStateUseCase.getWorkspaceById(workspaceList, workspaceId);

    if (!workspaceToActivate) {
      return {
        previousActiveWorkspace,
        shouldRestoreRuntime: false,
        workspaceList: [...workspaceList],
      };
    }

    const shouldRestoreRuntime = !workspaceToActivate.isOpen;
    const nextWorkspaceList: WorkspaceState[] = workspaceList.map((workspaceEntry) => ({
      ...workspaceEntry,
      isActive: workspaceEntry.id === workspaceId,
      isSelected: workspaceEntry.id === workspaceId,
      isOpen: workspaceEntry.id === workspaceId ? true : workspaceEntry.isOpen,
    }));
    const nextWorkspace = WorkspaceStateUseCase.getWorkspaceById(nextWorkspaceList, workspaceId);

    return {
      previousActiveWorkspace,
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
      isSelected: true,
      isActive: true,
      isOpen: false,
    };
  }

  static upsertWorkspace(
    workspaceList: ReadonlyArray<WorkspaceState>,
    workspace: WorkspaceConfiguration,
    previousActiveWorkspaceId?: string,
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
        isSelected: nextWorkspaceList[existingWorkspaceIndex].isSelected,
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
      isSelected: false,
      isOpen: workspaceEntry.id === previousActiveWorkspaceId ? false : workspaceEntry.isOpen,
    }));
    const workspacePosition = nextWorkspaceList.filter(
      (workspaceEntry) => workspaceEntry.id !== defaultWorkspaceIdContract,
    ).length;
    const workspaceEntry: WorkspaceState = {
      ...workspace,
      position: workspace.position ?? workspacePosition,
      isSelected: true,
      isActive: true,
      isOpen: true,
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
      return {
        closedWorkspace: workspaceToClose,
        workspaceList: [...workspaceList],
      };
    }

    const nextWorkspaceList: WorkspaceState[] = workspaceList.map((workspaceEntry) =>
      workspaceEntry.id !== workspaceId
        ? { ...workspaceEntry }
        : {
            ...workspaceEntry,
            isOpen: false,
            isActive: false,
            isSelected: false,
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

    if (
      !nextWorkspaceList.find((workspaceEntry) => workspaceEntry.isSelected) &&
      nextWorkspaceList[0]
    ) {
      nextWorkspaceList[0] = {
        ...nextWorkspaceList[0],
        isSelected: true,
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

    if (
      !nextWorkspaceList.find((workspaceEntry) => workspaceEntry.isSelected) &&
      nextWorkspaceList[0]
    ) {
      nextWorkspaceList[0] = {
        ...nextWorkspaceList[0],
        isSelected: true,
      };
    }

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
