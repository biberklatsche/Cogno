import type { ActionDispatcher, WorkspaceEntryContract, WorkspaceHostPort } from "@cogno/core-api";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { WorkspaceShortcutActionService } from "./workspace-shortcut-action.service";

describe("WorkspaceShortcutActionService", () => {
  let actionSubjects: Map<string, Subject<void>>;
  let actionDispatcher: ActionDispatcher;
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    actionSubjects = new Map();
    actionDispatcher = {
      dispatchAction: vi.fn(),
      onAction$: (actionName: string) => {
        if (!actionSubjects.has(actionName)) {
          actionSubjects.set(actionName, new Subject<void>());
        }
        return actionSubjects.get(actionName)!.asObservable();
      },
    } as unknown as ActionDispatcher;

    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", isActive: false },
      { id: "WS-2", name: "Project Two", isActive: false },
    ]);
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);

    const workspaceHostPort = {
      workspaceEntries$: workspaceEntriesSubject.asObservable(),
      restoreWorkspace: restoreWorkspaceMock,
      saveWorkspace: vi.fn().mockResolvedValue(undefined),
      closeWorkspace: vi.fn().mockResolvedValue(undefined),
      reorderWorkspaces: vi.fn().mockResolvedValue(undefined),
      persistWorkspaceOrder: vi.fn().mockResolvedValue(undefined),
      openCreateWorkspaceDialog: vi.fn(),
      openEditWorkspaceDialog: vi.fn(),
      deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceHostPort;

    new WorkspaceShortcutActionService(actionDispatcher, workspaceHostPort, getDestroyRef());
  });

  it("restores the default workspace for select_workspace_default", () => {
    actionSubjects.get("select_workspace_default")?.next();
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-DEFAULT");
  });

  it("restores the second list entry for select_workspace_1", () => {
    actionSubjects.get("select_workspace_1")?.next();
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
  });

  it("ignores numbered workspace shortcuts that exceed the visible list", () => {
    actionSubjects.get("select_workspace_9")?.next();
    expect(restoreWorkspaceMock).not.toHaveBeenCalled();
  });
});
