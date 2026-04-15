import { defaultWorkspaceIdContract } from "@cogno/core-api";
import { describe, expect, it } from "vitest";
import { WorkspaceStateUseCase } from "./workspace-state.use-case";

const persistedWorkspace = {
  id: "WS-1",
  name: "Project One",
  color: "blue",
  autosave: true,
  grids: [{ tabId: "TB-1", pane: {} }],
  tabs: [{ tabId: "TB-1" }],
};

describe("WorkspaceStateUseCase", () => {
  it("creates an initial workspace list with the default workspace selected", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState([persistedWorkspace]);

    expect(workspaceList[0].id).toBe(defaultWorkspaceIdContract);
    expect(workspaceList[0].isSelected).toBe(true);
    expect(workspaceList[0].isActive).toBe(true);
    expect(workspaceList[1].isOpen).toBe(false);
  });

  it("activates a workspace and marks runtime restore when it was closed", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState([persistedWorkspace]);

    const activationPlan = WorkspaceStateUseCase.activateWorkspace(workspaceList, "WS-1");

    expect(activationPlan.previousActiveWorkspace?.id).toBe(defaultWorkspaceIdContract);
    expect(activationPlan.workspaceToActivate?.id).toBe("WS-1");
    expect(activationPlan.shouldRestoreRuntime).toBe(true);
    expect(activationPlan.workspaceList[1].isActive).toBe(true);
    expect(activationPlan.workspaceList[1].isOpen).toBe(true);
  });

  it("reorders persisted workspaces without moving the default workspace", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState([
      persistedWorkspace,
      { ...persistedWorkspace, id: "WS-2", name: "Project Two" },
    ]);

    const nextWorkspaceList = WorkspaceStateUseCase.reorderWorkspaces(
      workspaceList,
      "WS-2",
      "WS-1",
    );

    expect(nextWorkspaceList.map((workspace) => workspace.id)).toEqual([
      defaultWorkspaceIdContract,
      "WS-2",
      "WS-1",
    ]);
    expect(nextWorkspaceList[1].position).toBe(0);
    expect(nextWorkspaceList[2].position).toBe(1);
  });

  it("closes an active workspace and resolves a fallback activation target", () => {
    const initialWorkspaceList = WorkspaceStateUseCase.createInitialWorkspaceState([
      persistedWorkspace,
    ]);
    const activeWorkspaceList = WorkspaceStateUseCase.activateWorkspace(
      initialWorkspaceList,
      "WS-1",
    ).workspaceList;

    const closePlan = WorkspaceStateUseCase.closeWorkspace(activeWorkspaceList, "WS-1");

    expect(closePlan.closedWorkspace?.id).toBe("WS-1");
    expect(closePlan.workspaceToActivateId).toBe(defaultWorkspaceIdContract);
    expect(closePlan.workspaceList[1].isOpen).toBe(false);
  });

  it("deletes the active workspace and resolves the first remaining workspace as fallback", () => {
    const workspaceList = [
      {
        ...WorkspaceStateUseCase.createDefaultWorkspace(),
        isSelected: false,
        isActive: false,
        isOpen: false,
      },
      { ...persistedWorkspace, id: "WS-1", isSelected: true, isActive: true, isOpen: true },
      {
        ...persistedWorkspace,
        id: "WS-2",
        name: "Project Two",
        isSelected: false,
        isActive: false,
        isOpen: false,
      },
    ];

    const deletePlan = WorkspaceStateUseCase.deleteWorkspace(workspaceList, "WS-1");

    expect(deletePlan.deletedWorkspace?.id).toBe("WS-1");
    expect(deletePlan.workspaceToActivateId).toBe(defaultWorkspaceIdContract);
    expect(deletePlan.workspaceList.map((workspace) => workspace.id)).toEqual([
      defaultWorkspaceIdContract,
      "WS-2",
    ]);
  });
});
