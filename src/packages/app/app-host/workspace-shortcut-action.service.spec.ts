import type { WorkspaceEntryContract, WorkspaceHostPortContract } from "@cogno/core-api";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppBus, getDestroyRef } from "../../__test__/test-factory";
import { ActionFired, type ActionFiredEvent } from "../action/action.models";
import type { AppBus } from "../app-bus/app-bus";
import { WorkspaceShortcutActionService } from "./workspace-shortcut-action.service";

describe("WorkspaceShortcutActionService", () => {
  let appBus: AppBus;
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appBus = getAppBus();
    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", isActive: false },
      { id: "WS-2", name: "Project Two", isActive: false },
    ]);
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);

    const workspaceHostPort: WorkspaceHostPortContract = {
      workspaceEntries$: workspaceEntriesSubject.asObservable(),
      restoreWorkspace: restoreWorkspaceMock,
      closeWorkspace: vi.fn().mockResolvedValue(undefined),
      reorderWorkspaces: vi.fn().mockResolvedValue(undefined),
      persistWorkspaceOrder: vi.fn().mockResolvedValue(undefined),
      openCreateWorkspaceDialog: vi.fn(),
      openEditWorkspaceDialog: vi.fn(),
      deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    };

    new WorkspaceShortcutActionService(appBus, workspaceHostPort, getDestroyRef());
  });

  function createActionEvent(actionName: string): ActionFiredEvent {
    return ActionFired.create(actionName, { all: false, unconsumed: false, performable: false });
  }

  it("restores the default workspace for select_workspace_default", () => {
    const event = createActionEvent("select_workspace_default");

    appBus.publish(event);

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-DEFAULT");
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("restores the second list entry for select_workspace_1", () => {
    const event = createActionEvent("select_workspace_1");

    appBus.publish(event);

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores numbered workspace shortcuts that exceed the visible list", () => {
    const event = createActionEvent("select_workspace_9");

    appBus.publish(event);

    expect(restoreWorkspaceMock).not.toHaveBeenCalled();
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });
});
