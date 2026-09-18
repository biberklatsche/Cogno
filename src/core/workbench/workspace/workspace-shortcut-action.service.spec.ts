import { signal, type WritableSignal } from "@angular/core";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { ActionFired } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { WorkspaceEntryContract } from "@cogno/shared/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../../__test__/destroy-ref";
import type { WorkspaceHostApplicationService } from "./workspace-host-application.service";
import { WorkspaceShortcutActionService } from "./workspace-shortcut-action.service";

describe("WorkspaceShortcutActionService", () => {
  let bus: AppBus;
  let workspaceEntries: WritableSignal<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bus = new AppBus();
    workspaceEntries = signal<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", isActive: false },
      { id: "WS-2", name: "Project Two", isActive: false },
    ]);
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);

    const workspaceHostPort = {
      workspaceEntries,
      restoreWorkspaceById: restoreWorkspaceMock,
      saveWorkspace: vi.fn().mockResolvedValue(undefined),
      closeWorkspace: vi.fn().mockResolvedValue(undefined),
      reorderWorkspaces: vi.fn().mockResolvedValue(undefined),
      persistWorkspaceOrder: vi.fn().mockResolvedValue(undefined),
      openCreateWorkspaceDialog: vi.fn(),
      openEditWorkspaceDialog: vi.fn(),
      deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceHostApplicationService;

    new WorkspaceShortcutActionService(new ActionHandlers(bus, getDestroyRef()), workspaceHostPort);
  });

  it("restores the default workspace for select_workspace_default", () => {
    bus.publish(ActionFired.create("select_workspace_default"));
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-DEFAULT");
  });

  it("restores the second list entry for select_workspace_1", () => {
    bus.publish(ActionFired.create("select_workspace_1"));
    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-1");
  });

  it("ignores numbered workspace shortcuts that exceed the visible list", () => {
    bus.publish(ActionFired.create("select_workspace_9"));
    expect(restoreWorkspaceMock).not.toHaveBeenCalled();
  });
});
