import type { Signal } from "@angular/core";
import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { WorkspaceHostService } from "@cogno/core/workbench/workspace/workspace-host.service";
import type { WorkspaceEntryContract } from "@cogno/shared/domain";
import type { ContextMenuOverlayService } from "@cogno/shared/ui";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigServiceMock } from "../../../__test__/mocks/config-service.mock";
import { getDestroyRef } from "../../../__test__/test-factory";
import { SelectedWorkspaceHeaderComponent } from "./selected-workspace-header.component";

type ContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openAtElement">;

type SelectedWorkspaceHeaderInternals = {
  activeWorkspace: Signal<WorkspaceEntryContract | undefined>;
  openWorkspaceMenu: (event: Event) => void;
};

describe("SelectedWorkspaceHeaderComponent", () => {
  let workspaceEntriesSubject: BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn<WorkspaceHostService["restoreWorkspace"]>>;
  let openAtElementMock: ReturnType<typeof vi.fn<ContextMenuOverlayService["openAtElement"]>>;
  let component: SelectedWorkspaceHeaderComponent;

  beforeEach(() => {
    workspaceEntriesSubject = new BehaviorSubject<ReadonlyArray<WorkspaceEntryContract>>([
      { id: "WS-1", name: "Workspace One", color: "blue", isActive: true, isOpen: true },
      { id: "WS-2", name: "Workspace Two", color: "red", isActive: false, isOpen: true },
      { id: "WS-3", name: "Workspace Three", isActive: false, isOpen: false },
    ]);
    restoreWorkspaceMock = vi
      .fn<WorkspaceHostService["restoreWorkspace"]>()
      .mockResolvedValue(undefined);
    openAtElementMock = vi.fn<ContextMenuOverlayService["openAtElement"]>();

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
    } as unknown as WorkspaceHostService;
    const contextMenuOverlayService: ContextMenuOverlayPort = {
      openAtElement: openAtElementMock,
    };

    const configService = new ConfigServiceMock();
    configService.setConfig({ terminal: { restore: { enabled: true } } } as never);

    component = new SelectedWorkspaceHeaderComponent(
      workspaceHostPort,
      contextMenuOverlayService as ContextMenuOverlayService,
      configService as unknown as ConfigService,
      getDestroyRef(),
    );
  });

  it("enables the dropdown only when multiple workspaces are open", () => {
    expect((component as any).hasWorkspaceMenu()).toBe(true);

    workspaceEntriesSubject.next([
      { id: "WS-1", name: "Workspace One", isActive: true, isOpen: true },
    ]);

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
    expect(openAtElementMock).toHaveBeenCalledTimes(1);

    const menuConfig = openAtElementMock.mock.calls[0][1] as {
      items: Array<{ label: string; action: () => void }>;
    };
    expect(menuConfig.items.map((item) => item.label)).toEqual(["Workspace One", "Workspace Two"]);

    menuConfig.items[1].action();

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("WS-2");
  });

  it("hides the header when only the default workspace is active", () => {
    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true, isOpen: true },
    ]);

    expect(
      (component as unknown as SelectedWorkspaceHeaderInternals).activeWorkspace(),
    ).toBeUndefined();
  });

  it("shows the default workspace when another workspace is open", () => {
    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: true, isOpen: true },
      { id: "WS-1", name: "Workspace One", isActive: false, isOpen: true },
    ]);

    expect((component as unknown as SelectedWorkspaceHeaderInternals).activeWorkspace()?.name).toBe(
      "Default Workspace",
    );
    expect((component as any).hasWorkspaceMenu()).toBe(true);
  });

  it("keeps the dirty marker state on the active workspace", () => {
    workspaceEntriesSubject.next([
      { id: "WS-1", name: "Workspace One", isActive: true, isOpen: true, isDirty: true },
    ]);

    expect(
      (component as unknown as SelectedWorkspaceHeaderInternals).activeWorkspace()?.isDirty,
    ).toBe(true);
  });

  it("includes the default workspace in the header menu when multiple workspaces are open", () => {
    workspaceEntriesSubject.next([
      { id: "WS-DEFAULT", name: "Default Workspace", isActive: false, isOpen: true },
      { id: "WS-1", name: "Workspace One", isActive: true, isOpen: true },
      { id: "WS-2", name: "Workspace Two", isActive: false, isOpen: true },
    ]);

    const button = document.createElement("button");
    (component as unknown as SelectedWorkspaceHeaderInternals).openWorkspaceMenu({
      currentTarget: button,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Event);

    const menuConfig = openAtElementMock.mock.calls.at(-1)?.[1] as {
      items: Array<{ label: string }>;
    };
    expect(menuConfig.items.map((item) => item.label)).toEqual([
      "Default Workspace",
      "Workspace One",
      "Workspace Two",
    ]);
  });
});
