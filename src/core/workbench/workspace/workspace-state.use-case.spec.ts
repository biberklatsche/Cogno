import { describe, expect, it } from "vitest";
import { defaultWorkspaceIdContract } from "./workspace-entry";
import { WorkspaceStateUseCase } from "./workspace-state.use-case";

const persistedWorkspace = {
  id: "WS-1",
  name: "Project One",
  color: "blue",
  grids: [{ tabId: "TB-1", pane: {} }],
  tabs: [{ tabId: "TB-1" }],
  stacks: [],
};

const defaultWorkspace = WorkspaceStateUseCase.createDefaultWorkspace(
  defaultWorkspaceIdContract,
  "TB-DEFAULT",
);

describe("WorkspaceStateUseCase", () => {
  it("creates an initial workspace list with the default workspace selected", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
      [persistedWorkspace],
      defaultWorkspace,
    );

    expect(workspaceList[0].id).toBe(defaultWorkspaceIdContract);
    expect(workspaceList[0].isActive).toBe(true);
    expect(workspaceList[1].isOpen).toBe(false);
  });

  it("activates a workspace and marks runtime restore when it was closed", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
      [persistedWorkspace],
      defaultWorkspace,
    );

    const activationPlan = WorkspaceStateUseCase.activateWorkspace(workspaceList, "WS-1");

    expect(activationPlan.workspaceToActivate?.id).toBe("WS-1");
    expect(activationPlan.shouldRestoreRuntime).toBe(true);
    expect(activationPlan.workspaceList[1].isActive).toBe(true);
    expect(activationPlan.workspaceList[1].isOpen).toBe(true);
  });

  it("reorders persisted workspaces without moving the default workspace", () => {
    const workspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
      [persistedWorkspace, { ...persistedWorkspace, id: "WS-2", name: "Project Two" }],
      defaultWorkspace,
    );

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
    const initialWorkspaceList = WorkspaceStateUseCase.createInitialWorkspaceState(
      [persistedWorkspace],
      defaultWorkspace,
    );
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
        ...defaultWorkspace,
        isActive: false,
        isOpen: false,
      },
      { ...persistedWorkspace, id: "WS-1", isActive: true, isOpen: true },
      {
        ...persistedWorkspace,
        id: "WS-2",
        name: "Project Two",
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

  describe("adoptLeftOverShells", () => {
    const tabIds = () => {
      let next = 0;
      return () => `TB-NEW-${++next}`;
    };

    it("changes nothing when every running shell has a pane somewhere", () => {
      const placed = {
        ...persistedWorkspace,
        grids: [{ tabId: "TB-1", pane: { leftChild: { terminalId: "a" }, rightChild: {} } }],
      };

      const plan = WorkspaceStateUseCase.adoptLeftOverShells(
        [placed],
        defaultWorkspace,
        ["a"],
        tabIds(),
      );

      expect(plan).toEqual({ workspaces: [placed], adoptedTabIds: [] });
    });

    it("gives a shell without a pane a tab in the default workspace, which it opens", () => {
      const plan = WorkspaceStateUseCase.adoptLeftOverShells(
        [persistedWorkspace],
        defaultWorkspace,
        ["a", "b"],
        tabIds(),
      );

      expect(plan.adoptedTabIds).toEqual(["TB-NEW-1", "TB-NEW-2"]);
      expect(plan.workspaces).toEqual([
        {
          ...defaultWorkspace,
          isOpen: true,
          tabs: [{ tabId: "TB-DEFAULT" }, { tabId: "TB-NEW-1" }, { tabId: "TB-NEW-2" }],
          grids: [
            { tabId: "TB-DEFAULT", pane: {} },
            { tabId: "TB-NEW-1", pane: { terminalId: "a" } },
            { tabId: "TB-NEW-2", pane: { terminalId: "b" } },
          ],
        },
        // Untouched.
        persistedWorkspace,
      ]);
    });

    it("adds to the default workspace as it was saved, keeping what it had", () => {
      const savedDefault = {
        ...defaultWorkspace,
        isActive: true,
        tabs: [{ tabId: "TB-OLD" }],
        grids: [{ tabId: "TB-OLD", pane: { terminalId: "mine" } }],
      };

      const plan = WorkspaceStateUseCase.adoptLeftOverShells(
        [persistedWorkspace, savedDefault],
        defaultWorkspace,
        ["mine", "left"],
        tabIds(),
      );

      expect(plan.adoptedTabIds).toEqual(["TB-NEW-1"]);
      expect(plan.workspaces[0]).toMatchObject({
        isActive: true,
        tabs: [{ tabId: "TB-OLD" }, { tabId: "TB-NEW-1" }],
        grids: [
          { tabId: "TB-OLD", pane: { terminalId: "mine" } },
          { tabId: "TB-NEW-1", pane: { terminalId: "left" } },
        ],
      });
      expect(plan.workspaces).toHaveLength(2);
    });
  });
});
