import { signal, type WritableSignal } from "@angular/core";
import type { TerminalBusyStateService } from "@cogno/core/workbench/terminal/terminal-busy-state.service";
import { WorkspaceService } from "@cogno/core/workbench/workspace/workspace.service";
import type { WorkspaceEntryContract } from "@cogno/shared/domain";
import type { DialogService } from "@cogno/shared/ui";
import type { DirectionalNavigationItem } from "@cogno/shared/ui/common/navigation/directional-navigation.engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceHostApplicationService } from "./workspace-host-application.service";

describe("WorkspaceService", () => {
  let workspaceService: WorkspaceService;
  let workspaceEntries: WritableSignal<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;
  let saveWorkspaceMock: ReturnType<typeof vi.fn>;
  let closeWorkspaceMock: ReturnType<typeof vi.fn>;
  let reorderWorkspacesMock: ReturnType<typeof vi.fn>;
  let persistWorkspaceOrderMock: ReturnType<typeof vi.fn>;
  let openCreateWorkspaceDialogMock: ReturnType<typeof vi.fn<() => void>>;
  let openEditWorkspaceDialogMock: ReturnType<typeof vi.fn<(workspaceName: string) => void>>;
  let deleteWorkspaceMock: ReturnType<typeof vi.fn>;
  let confirmCloseWorkspaceMock: ReturnType<typeof vi.fn>;
  let clearRestoreDataMock: ReturnType<typeof vi.fn>;
  let confirmDialogRef: { close: (result?: boolean) => void } | undefined;

  beforeEach(() => {
    workspaceEntries = signal<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", color: "blue", isActive: false },
      { id: "WS-2", name: "Project Two", color: "red", isActive: false },
    ]);

    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    saveWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    closeWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    reorderWorkspacesMock = vi.fn().mockResolvedValue(undefined);
    persistWorkspaceOrderMock = vi.fn().mockResolvedValue(undefined);
    deleteWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    clearRestoreDataMock = vi.fn().mockResolvedValue(undefined);
    confirmCloseWorkspaceMock = vi.fn().mockResolvedValue(true);
    // The dialogs are what "open create/edit" amounts to now.
    const openDialogMock = vi.fn();
    openCreateWorkspaceDialogMock = vi.fn<() => void>();
    openEditWorkspaceDialogMock = vi.fn<(workspaceName: string) => void>();
    openDialogMock.mockImplementation((_component: unknown, config: { title: string }) => {
      if (config.title === "Delete restore data") {
        confirmDialogRef = { close: vi.fn() };
        return confirmDialogRef;
      }
      if (config.title === "Create workspace") openCreateWorkspaceDialogMock();
      else openEditWorkspaceDialogMock(config.title.replace("Edit ", ""));
    });

    const workspaces = {
      workspaceEntries,
      restoreWorkspaceById: restoreWorkspaceMock,
      saveWorkspace: saveWorkspaceMock,
      closeWorkspace: closeWorkspaceMock,
      reorderWorkspaces: reorderWorkspacesMock,
      persistWorkspaceOrder: persistWorkspaceOrderMock,
      deleteWorkspace: deleteWorkspaceMock,
      clearRestoreData: clearRestoreDataMock,
      createWorkspaceDraft: () => ({ id: "draft", name: "" }),
      getWorkspaceById: (id: string) => ({ id, name: id }),
    } as unknown as WorkspaceHostApplicationService;

    workspaceService = new WorkspaceService(
      workspaces,
      {
        confirmProceedIfNoBusyTerminalsInWorkspace: confirmCloseWorkspaceMock,
      } as unknown as TerminalBusyStateService,
      { open: openDialogMock } as unknown as DialogService,
    );
  });

  it("clears the restore data only after the user confirms", async () => {
    const cancelled = workspaceService.clearRestoreData();
    confirmDialogRef?.close(false);
    await cancelled;
    expect(clearRestoreDataMock).not.toHaveBeenCalled();

    const confirmed = workspaceService.clearRestoreData();
    confirmDialogRef?.close(true);
    await confirmed;
    expect(clearRestoreDataMock).toHaveBeenCalledTimes(1);
  });

  it("initializes workspace entries from host", () => {
    const workspaceEntries = workspaceService.workspaceEntries();
    expect(workspaceEntries.length).toBe(3);
    expect(workspaceEntries[0].isSelected).toBe(true);
  });

  it("selects next workspace by navigation", () => {
    workspaceService.registerNavigationItemsProvider(() => [
      createNavigationItem("WS-DEFAULT", 0, 0, 120, 60),
      createNavigationItem("WS-1", 140, 0, 120, 60),
      createNavigationItem("WS-2", 0, 90, 120, 60),
    ]);

    workspaceService.selectNext("right");
    expect(workspaceService.workspaceEntries()[1].isSelected).toBe(true);
  });

  it("moves through a variable grid using registered geometry", () => {
    workspaceEntries.set([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", color: "blue", isActive: false },
      { id: "WS-2", name: "Project Two", color: "red", isActive: false },
      { id: "WS-3", name: "Project Three", color: "yellow", isActive: false },
    ]);

    workspaceService.registerNavigationItemsProvider(() => [
      createNavigationItem("WS-DEFAULT", 0, 0, 120, 60),
      createNavigationItem("WS-1", 140, 0, 120, 60),
      createNavigationItem("WS-2", 0, 90, 180, 60),
      createNavigationItem("WS-3", 200, 90, 120, 60),
    ]);
    workspaceService.selectNext("right");
    workspaceService.selectNext("down");

    expect(workspaceService.workspaceEntries()[3].isSelected).toBe(true);
  });

  it("restores selected workspace", async () => {
    workspaceService.selectNext("right");
    await workspaceService.restoreSelectedWorkspace();
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
  });

  it("delegates create, save, edit and delete operations to host", async () => {
    await workspaceService.closeWorkspace("WS-1");
    await workspaceService.reorderWorkspaces("WS-2", "WS-1");
    await workspaceService.persistWorkspaceOrder();
    workspaceService.openCreateWorkspaceDialog();
    await workspaceService.saveWorkspace("WS-1");
    workspaceService.openEditWorkspaceDialog("WS-1");
    await workspaceService.deleteWorkspace("WS-2");

    expect(closeWorkspaceMock).toHaveBeenCalledWith("WS-1");
    expect(reorderWorkspacesMock).toHaveBeenCalledWith("WS-2", "WS-1");
    expect(persistWorkspaceOrderMock).toHaveBeenCalledTimes(1);
    expect(openCreateWorkspaceDialogMock).toHaveBeenCalledTimes(1);
    expect(saveWorkspaceMock).toHaveBeenCalledWith("WS-1");
    expect(openEditWorkspaceDialogMock).toHaveBeenCalledWith("WS-1");
    expect(deleteWorkspaceMock).toHaveBeenCalledWith("WS-2");
  });

  it("does not close a workspace when busy terminals block the action", async () => {
    confirmCloseWorkspaceMock.mockResolvedValue(false);

    await workspaceService.closeWorkspace("WS-1");

    expect(closeWorkspaceMock).not.toHaveBeenCalled();
  });
});

function createNavigationItem(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): DirectionalNavigationItem<string> {
  return {
    id,
    rect: {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    },
  };
}
