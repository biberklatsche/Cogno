import { beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import { WorkspaceEntryContract, WorkspaceHostPortContract } from "@cogno/core-sdk";
import { WorkspaceService } from "@cogno/features/side-menu/workspace/workspace.service";
import { getDestroyRef } from "../../__test__/destroy-ref";

describe("WorkspaceService", () => {
  let workspaceService: WorkspaceService;
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;
  let closeWorkspaceMock: ReturnType<typeof vi.fn>;
  let openCreateWorkspaceDialogMock: ReturnType<typeof vi.fn>;
  let openEditWorkspaceDialogMock: ReturnType<typeof vi.fn>;
  let deleteWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", color: "blue", autosave: true, isActive: false },
      { id: "WS-2", name: "Project Two", color: "red", autosave: false, isActive: false },
    ]);

    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    closeWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    openCreateWorkspaceDialogMock = vi.fn();
    openEditWorkspaceDialogMock = vi.fn();
    deleteWorkspaceMock = vi.fn().mockResolvedValue(undefined);

    const workspaceHostPort: WorkspaceHostPortContract = {
      workspaceEntries$: workspaceEntriesSubject.asObservable(),
      restoreWorkspace: restoreWorkspaceMock,
      closeWorkspace: closeWorkspaceMock,
      openCreateWorkspaceDialog: openCreateWorkspaceDialogMock,
      openEditWorkspaceDialog: openEditWorkspaceDialogMock,
      deleteWorkspace: deleteWorkspaceMock,
    };

    workspaceService = new WorkspaceService(workspaceHostPort, getDestroyRef());
    workspaceService.initializeSelection();
  });

  it("initializes workspace entries from host", () => {
    const workspaceEntries = workspaceService.workspaceEntries();
    expect(workspaceEntries.length).toBe(3);
    expect(workspaceEntries[0].isSelected).toBe(true);
  });

  it("selects next workspace by navigation", () => {
    workspaceService.selectNext("right");
    expect(workspaceService.workspaceEntries()[1].isSelected).toBe(true);
  });

  it("restores selected workspace", async () => {
    workspaceService.selectNext("right");
    await workspaceService.restoreSelectedWorkspace();
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
  });

  it("delegates create, edit and delete operations to host", async () => {
    await workspaceService.closeWorkspace("WS-1");
    workspaceService.openCreateWorkspaceDialog();
    workspaceService.openEditWorkspaceDialog("WS-1");
    await workspaceService.deleteWorkspace("WS-2");

    expect(closeWorkspaceMock).toHaveBeenCalledWith("WS-1");
    expect(openCreateWorkspaceDialogMock).toHaveBeenCalledTimes(1);
    expect(openEditWorkspaceDialogMock).toHaveBeenCalledWith("WS-1");
    expect(deleteWorkspaceMock).toHaveBeenCalledWith("WS-2");
  });
});
