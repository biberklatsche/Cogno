import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { Grid } from "@cogno/core/workbench/grid-list/+model/model";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import type { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  emitSessionFact,
  getAppBus,
  getConfigService,
  getDestroyRef,
  getGridListService,
  getSideMenuService,
  getTabListService,
} from "../../../__test__/test-factory";
import type { SessionPersistenceService } from "./session-persistence.service";
import type { WorkspaceRepository } from "./workspace.repository";
import { WorkspaceHostApplicationService } from "./workspace-host-application.service";

describe("WorkspaceHostApplicationService", () => {
  let bus: AppBus;
  let sideMenuService: SideMenuService;
  let gridListService: GridListService;
  let tabListService: TabListService;
  let workspaceRepository: WorkspaceRepository;
  let service: WorkspaceHostApplicationService;

  beforeEach(() => {
    bus = getAppBus();
    sideMenuService = getSideMenuService();
    gridListService = getGridListService();
    tabListService = getTabListService();
    getConfigService().setConfig({
      shell: {
        default: "test",
        profiles: {
          test: {
            shell_type: "PowerShell",
            inject_cogno_cli: true,
            enable_shell_integration: true,
          },
        },
      },
    } as any);

    workspaceRepository = {
      getAllWorkspaces: vi.fn().mockResolvedValue([
        {
          id: "WS-1",
          name: "Workspace One",
          color: "blue",
          isActive: true,
          tabs: [{ tabId: "T-1", isActive: true, systemTitle: "Shell" }],
          grids: [{ tabId: "T-1", pane: { workingDir: "C:\\repo" } }],
        },
      ]),
      updateWorkspace: vi.fn(),
      upsertWorkspace: vi.fn().mockResolvedValue(undefined),
      deleteTerminalSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceRepository;

    service = new WorkspaceHostApplicationService(
      bus,
      sideMenuService,
      workspaceRepository,
      gridListService,
      tabListService,
      { config: { terminal: { restore: { enabled: true } } } } as unknown as ConfigService,
      {
        persistWorkspace: vi.fn().mockResolvedValue(undefined),
        loadPendingSnapshots: vi.fn().mockResolvedValue(undefined),
      } as unknown as SessionPersistenceService,
      { facts$: new Subject() } as unknown as TerminalSessionRegistry,
      getDestroyRef(),
    );
  });

  afterEach(() => {
    clear();
    vi.restoreAllMocks();
  });

  it("does not mark a restored workspace dirty for focus and title sync", async () => {
    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(service.getWorkspaceById("WS-1")?.isDirty).toBe(false);
    });

    const terminalId = getSingleTerminalId(gridListService);
    emitSessionFact(terminalId, { type: "focusChanged", focused: true });
    emitSessionFact(terminalId, { type: "titleChanged", oscCode: 2, title: "pwsh" });

    expect(service.getWorkspaceById("WS-1")?.isDirty).toBe(false);
  });

  it("marks a workspace saved after an autosave (step 27g)", async () => {
    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getWorkspaceById("WS-1")).toBeTruthy();
    });

    await service.autoPersistWorkspace("WS-1");

    const workspace = service.getWorkspaceById("WS-1");
    expect(workspace?.autoSaveStatus).toBe("saved");
    expect(typeof workspace?.autoSavedAt).toBe("number");
  });

  it("marks a workspace dirty when the working directory changes", async () => {
    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(getSingleTerminalId(gridListService)).toBeTruthy();
    });
    const terminalId = getSingleTerminalId(gridListService);
    emitSessionFact(terminalId, { type: "cwdReported", cwd: "C:\\other" });

    expect(service.getWorkspaceById("WS-1")?.isDirty).toBe(true);
  });

  it("marks a workspace dirty when a tab is added", async () => {
    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(service.getWorkspaceById("WS-1")).toBeTruthy();
    });

    bus.publish({
      type: "CreateTab",
      payload: { tabId: "T-2", isActive: false, systemTitle: "Shell" },
    });

    expect(service.getWorkspaceById("WS-1")?.isDirty).toBe(true);
  });

  it("creates a workspace draft with an empty id and one tab", () => {
    const draft = service.createWorkspaceDraft();

    expect(draft.id).toBe("");
    expect(draft.tabs).toHaveLength(1);
    expect(draft.grids).toHaveLength(1);
    expect(draft.isActive).toBe(true);
    expect(draft.isSelected).toBe(true);
  });

  it("repairs duplicate tab ids across persisted workspaces on startup", async () => {
    const getAllWorkspacesMock = workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>;
    const updateWorkspaceSpy = workspaceRepository.updateWorkspace as ReturnType<typeof vi.fn>;
    getAllWorkspacesMock.mockResolvedValue([
      {
        id: "WS-1",
        name: "Workspace One",
        color: "blue",
        isActive: true,
        tabs: [{ tabId: "TB_DEFAULT", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "TB_DEFAULT", pane: { workingDir: "C:\\repo" } }],
      },
      {
        id: "WS-2",
        name: "Workspace Two",
        color: "red",
        tabs: [{ tabId: "TB_DEFAULT", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "TB_DEFAULT", pane: { workingDir: "C:\\other" } }],
      },
    ]);

    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(updateWorkspaceSpy).toHaveBeenCalledTimes(1);
    });

    const repairedWorkspace = updateWorkspaceSpy.mock.calls[0][0];
    expect(repairedWorkspace.id).toBe("WS-2");
    expect(repairedWorkspace.tabs[0].tabId).not.toBe("TB_DEFAULT");
    expect(repairedWorkspace.grids[0].tabId).toBe(repairedWorkspace.tabs[0].tabId);
  });

  it("repairs duplicate terminal ids across persisted workspaces on startup", async () => {
    const getAllWorkspacesMock = workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>;
    const updateWorkspaceSpy = workspaceRepository.updateWorkspace as ReturnType<typeof vi.fn>;
    getAllWorkspacesMock.mockResolvedValue([
      {
        id: "WS-1",
        name: "Workspace One",
        color: "blue",
        isActive: true,
        tabs: [{ tabId: "T-1", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "T-1", pane: { workingDir: "C:\\repo", terminalId: "TE-DUP" } }],
      },
      {
        id: "WS-2",
        name: "Workspace Two",
        color: "red",
        tabs: [{ tabId: "T-2", isActive: true, systemTitle: "Shell" }],
        grids: [
          {
            tabId: "T-2",
            pane: {
              splitDirection: "horizontal",
              ratio: 0.5,
              leftChild: { workingDir: "C:\\other", terminalId: "TE-DUP" },
              rightChild: { workingDir: "C:\\other", terminalId: "TE-OWN" },
            },
          },
        ],
      },
    ]);

    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(updateWorkspaceSpy).toHaveBeenCalledTimes(1);
    });

    const repairedWorkspace = updateWorkspaceSpy.mock.calls[0][0];
    expect(repairedWorkspace.id).toBe("WS-2");
    expect(repairedWorkspace.tabs[0].tabId).toBe("T-2");
    expect(repairedWorkspace.grids[0].pane.leftChild.terminalId).not.toBe("TE-DUP");
    expect(repairedWorkspace.grids[0].pane.rightChild.terminalId).toBe("TE-OWN");
    // The snapshot under the old id belongs to WS-1, which kept the id.
    expect(workspaceRepository.deleteTerminalSession).toHaveBeenCalledExactlyOnceWith(
      "WS-2",
      "TE-DUP",
    );
  });

  it("opens a new workspace as a copy of the active layout with its own tabs and terminals", async () => {
    const createWorkspaceSpy = vi.fn().mockResolvedValue(undefined);
    (workspaceRepository as { createWorkspace?: unknown }).createWorkspace = createWorkspaceSpy;
    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(getSingleTerminalId(gridListService)).toBeTruthy();
    });
    const keptTerminalId = getSingleTerminalId(gridListService);
    gridListService.split(keptTerminalId, "vertical", "r");
    const keptTerminalIds = gridListService.terminalIdsForWorkspace("WS-1");
    expect(keptTerminalIds).toHaveLength(2);

    const newWorkspaceId = await service.save({ ...service.createWorkspaceDraft(), name: "Two" });

    // The source keeps its sessions and its configuration ...
    expect(gridListService.terminalIdsForWorkspace("WS-1")).toEqual(keptTerminalIds);
    expect(service.getWorkspaceById("WS-1")?.isOpen).toBe(true);
    expect(service.getWorkspaceById("WS-1")?.tabs[0].tabId).toBe("T-1");
    // ... the copy is persisted with fresh tab ids and no terminal ids ...
    const persisted = createWorkspaceSpy.mock.calls[0][0];
    expect(persisted.id).toBe(newWorkspaceId);
    expect(persisted.tabs).toHaveLength(1);
    expect(persisted.tabs[0].tabId).not.toBe("T-1");
    expect(persisted.grids[0].tabId).toBe(persisted.tabs[0].tabId);
    expect(persisted.grids[0].pane.splitDirection).toBe("vertical");
    expect(persisted.grids[0].pane.leftChild.workingDir).toBe("C:\\repo");
    expect(JSON.stringify(persisted.grids)).not.toContain("terminalId");
    // ... and it is the active one, with two terminals of its own.
    expect(service.getActiveWorkspace()?.id).toBe(newWorkspaceId);
    const newTerminalIds = gridListService.terminalIdsForWorkspace(newWorkspaceId);
    expect(newTerminalIds).toHaveLength(2);
    expect(newTerminalIds).not.toContain(keptTerminalIds[0]);
    expect(newTerminalIds).not.toContain(keptTerminalIds[1]);
  });

  it("ignores saveWorkspace for the default workspace or missing workspaces", async () => {
    const updateWorkspaceSpy = workspaceRepository.updateWorkspace as ReturnType<typeof vi.fn>;

    await service.saveWorkspace("default");
    await service.saveWorkspace("missing");

    expect(updateWorkspaceSpy).not.toHaveBeenCalled();
  });
});

function getSingleTerminalId(gridListService: GridListService): string {
  let grids: Grid[] = [];
  gridListService.grids$.subscribe((value) => {
    grids = value;
  });

  const terminalId = grids[0]?.tree.root.data?.terminalId;
  if (!terminalId) {
    throw new Error("Expected a restored terminal id.");
  }

  return terminalId;
}
