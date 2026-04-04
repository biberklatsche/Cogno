import { BehaviorSubject } from "rxjs";
import { ContextMenuOverlayService } from "@cogno/app/menu/context-menu-overlay/context-menu-overlay.service";
import { WorkspaceEntryContract, WorkspaceHostPortContract } from "@cogno/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../__test__/test-factory";
import { SelectedWorkspaceHeaderComponent } from "./selected-workspace-header.component";

type ContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openContextForElement">;

describe("SelectedWorkspaceHeaderComponent", () => {
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;
  let openContextForElementMock: ReturnType<typeof vi.fn>;
  let component: SelectedWorkspaceHeaderComponent;

  beforeEach(() => {
    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-1", name: "Workspace One", color: "blue", isActive: true, isOpen: true },
      { id: "WS-2", name: "Workspace Two", color: "red", isActive: false, isOpen: true },
      { id: "WS-3", name: "Workspace Three", isActive: false, isOpen: false },
    ]);
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    openContextForElementMock = vi.fn();

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
    const contextMenuOverlayService: ContextMenuOverlayPort = {
      openContextForElement: openContextForElementMock,
    };

    component = new SelectedWorkspaceHeaderComponent(
      workspaceHostPort,
      contextMenuOverlayService as ContextMenuOverlayService,
      getDestroyRef(),
    );
  });

  it("enables the dropdown only when multiple workspaces are open", () => {
    expect((component as any).hasWorkspaceMenu()).toBe(true);

    workspaceEntriesSubject.next([{ id: "WS-1", name: "Workspace One", isActive: true, isOpen: true }]);

    expect((component as any).hasWorkspaceMenu()).toBe(false);
  });

  it("opens a menu with open workspaces and restores the selected one", () => {
    const button = document.createElement("button");
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    (component as any).openWorkspaceMenu({
      currentTarget: button,
      preventDefault,
      stopPropagation,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(openContextForElementMock).toHaveBeenCalledTimes(1);

    const menuConfig = openContextForElementMock.mock.calls[0][1] as { items: Array<{ label: string; action: () => void }> };
    expect(menuConfig.items.map((item) => item.label)).toEqual(["Workspace One (active)", "Workspace Two"]);

    menuConfig.items[1].action();

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-2");
  });

  it("hides the header when the default workspace is active", () => {
    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true, isOpen: true },
      { id: "WS-1", name: "Workspace One", isActive: false, isOpen: true },
    ]);

    expect(component["activeWorkspace"]()).toBeUndefined();
  });

  it("does not include the default workspace in the header menu", () => {
    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: false, isOpen: true },
      { id: "WS-1", name: "Workspace One", isActive: true, isOpen: true },
      { id: "WS-2", name: "Workspace Two", isActive: false, isOpen: true },
    ]);

    const button = document.createElement("button");
    component["openWorkspaceMenu"]({
      currentTarget: button,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as Event);

    const menuConfig = openContextForElementMock.mock.calls.at(-1)?.[1] as {
      items: Array<{ label: string }>;
    };
    expect(menuConfig.items.map((item) => item.label)).toEqual([
      "Workspace One (active)",
      "Workspace Two",
    ]);
  });
});
