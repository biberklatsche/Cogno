import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceShortcutActionService } from "./workspace-shortcut-action.service";
import { getAppBus, getDestroyRef } from "../../__test__/test-factory";
import { AppBus } from "../app-bus/app-bus";
import { WorkspaceService, WorkspaceEntryViewModel } from "@cogno/features/side-menu/workspace/workspace.service";

describe("WorkspaceShortcutActionService", () => {
  let appBus: AppBus;
  let workspaceEntries: WorkspaceEntryViewModel[];
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appBus = getAppBus();
    workspaceEntries = [
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true, isSelected: true },
      { id: "WS-1", name: "Project One", isActive: false, isSelected: false },
      { id: "WS-2", name: "Project Two", isActive: false, isSelected: false },
    ];
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);

    const workspaceService = {
      workspaceEntries: () => workspaceEntries,
      restoreWorkspace: restoreWorkspaceMock,
    } as unknown as WorkspaceService;

    new WorkspaceShortcutActionService(appBus, workspaceService, getDestroyRef());
  });

  it("restores the default workspace for select_workspace_default", () => {
    const event = {
      type: "ActionFired",
      payload: "select_workspace_default",
      path: ["app", "action"],
      trigger: { all: false },
    } as any;

    appBus.publish(event);

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-DEFAULT");
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("restores the second list entry for select_workspace_1", () => {
    const event = {
      type: "ActionFired",
      payload: "select_workspace_1",
      path: ["app", "action"],
      trigger: { all: false },
    } as any;

    appBus.publish(event);

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores numbered workspace shortcuts that exceed the visible list", () => {
    const event = {
      type: "ActionFired",
      payload: "select_workspace_9",
      path: ["app", "action"],
      trigger: { all: false },
    } as any;

    appBus.publish(event);

    expect(restoreWorkspaceMock).not.toHaveBeenCalled();
    expect(event.performed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });
});
