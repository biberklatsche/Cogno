import { beforeEach, describe, expect, it, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import { WorkspaceEntryContract, WorkspaceHostPortContract } from "@cogno/core-sdk";
import { AppBus } from "@cogno/app/app-bus/app-bus";
import { getDestroyRef } from "../../__test__/destroy-ref";
import { WorkspaceBusBridgeService } from "./workspace-bus-bridge.service";

describe("WorkspaceBusBridgeService", () => {
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let workspaceHostPort: WorkspaceHostPortContract;
  let appBus: AppBus;

  beforeEach(() => {
    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true },
      { id: "WS-1", name: "Project One", color: "blue", isActive: false },
    ]);
    workspaceHostPort = {
      workspaceEntries$: workspaceEntriesSubject.asObservable(),
      restoreWorkspace: vi.fn().mockResolvedValue(undefined),
      closeWorkspace: vi.fn().mockResolvedValue(undefined),
      reorderWorkspaces: vi.fn().mockResolvedValue(undefined),
      persistWorkspaceOrder: vi.fn().mockResolvedValue(undefined),
      openCreateWorkspaceDialog: vi.fn(),
      openEditWorkspaceDialog: vi.fn(),
      deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    };
    appBus = new AppBus();
  });

  it("publishes the active workspace to the app bus", () => {
    const selectedWorkspacePayloads: Array<{ readonly color?: string; readonly id: string; readonly name: string } | undefined> = [];

    appBus.onType$("SelectedWorkspaceChanged").subscribe((selectedWorkspaceChangedEvent) => {
      selectedWorkspacePayloads.push(selectedWorkspaceChangedEvent.payload);
    });

    new WorkspaceBusBridgeService(workspaceHostPort, appBus, getDestroyRef());

    expect(selectedWorkspacePayloads).toEqual([undefined]);
  });

  it("publishes updates when the active workspace changes", () => {
    const selectedWorkspacePayloads: Array<{ readonly color?: string; readonly id: string; readonly name: string } | undefined> = [];

    appBus.onType$("SelectedWorkspaceChanged").subscribe((selectedWorkspaceChangedEvent) => {
      selectedWorkspacePayloads.push(selectedWorkspaceChangedEvent.payload);
    });

    new WorkspaceBusBridgeService(workspaceHostPort, appBus, getDestroyRef());

    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: false },
      { id: "WS-1", name: "Project One", color: "blue", isActive: true },
    ]);

    expect(selectedWorkspacePayloads.at(-1)).toEqual({
      id: "WS-1",
      name: "Project One",
      color: "blue",
    });
  });
});
