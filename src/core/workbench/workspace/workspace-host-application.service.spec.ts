import type { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { Grid } from "@cogno/core/workbench/grid-list/+model/model";
import { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import { SideMenuService } from "@cogno/core/workbench/side-menu/+state/side-menu.service";
import { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import type { TerminalSessionRegistry } from "@cogno/core/workbench/terminal/+state/terminal-session.registry";
import type { AppWindow } from "@cogno/platform/window";
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
import type { DiscardSessionMarker } from "./discard-session.marker";
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
  let restoreSettings: { enabled: boolean };
  let clearRestoreDataInDb: ReturnType<typeof vi.fn>;
  let forgetPendingSnapshots: ReturnType<typeof vi.fn>;
  let persistWorkspaceSnapshots: ReturnType<typeof vi.fn>;
  let discardSessionMarker: {
    isSet: boolean;
    set: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let appWindow: {
    isMain: boolean;
    claimWorkspace: ReturnType<typeof vi.fn>;
    releaseWorkspace: ReturnType<typeof vi.fn>;
  };

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

    clearRestoreDataInDb = vi.fn().mockResolvedValue(undefined);
    forgetPendingSnapshots = vi.fn();
    persistWorkspaceSnapshots = vi.fn().mockResolvedValue(undefined);
    discardSessionMarker = { isSet: false, set: vi.fn(), clear: vi.fn() };
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
      saveOpenState: vi.fn().mockResolvedValue(undefined),
      clearRestoreData: clearRestoreDataInDb,
    } as unknown as WorkspaceRepository;

    restoreSettings = { enabled: true };
    appWindow = {
      isMain: true,
      claimWorkspace: vi.fn().mockResolvedValue(true),
      releaseWorkspace: vi.fn().mockResolvedValue(undefined),
    };
    service = new WorkspaceHostApplicationService(
      bus,
      sideMenuService,
      workspaceRepository,
      gridListService,
      tabListService,
      { config: { terminal: { restore: restoreSettings } } } as unknown as ConfigService,
      {
        persistWorkspace: persistWorkspaceSnapshots,
        loadPendingSnapshots: vi.fn().mockResolvedValue(undefined),
        forgetPendingSnapshots,
      } as unknown as SessionPersistenceService,
      appWindow as unknown as AppWindow,
      discardSessionMarker as unknown as DiscardSessionMarker,
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

  it("flags a failed autosave until the next one succeeds (step 27g)", async () => {
    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getWorkspaceById("WS-1")).toBeTruthy();
    });
    persistWorkspaceSnapshots.mockRejectedValueOnce(new Error("disk full"));

    await expect(service.autoPersistWorkspace("WS-1")).rejects.toThrow("disk full");
    expect(service.getWorkspaceById("WS-1")?.autoSaveFailed).toBe(true);

    await service.autoPersistWorkspace("WS-1");
    expect(service.getWorkspaceById("WS-1")?.autoSaveFailed).toBe(false);
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

  describe("open state across restarts", () => {
    const threeWorkspaces = () => [
      {
        id: "WS-1",
        name: "Open in the background",
        color: "blue",
        isOpen: true,
        isActive: false,
        tabs: [{ tabId: "T-1", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "T-1", pane: { workingDir: "C:\\one" } }],
      },
      {
        id: "WS-2",
        name: "Was active",
        color: "red",
        isOpen: true,
        isActive: true,
        tabs: [{ tabId: "T-2", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "T-2", pane: { workingDir: "C:\\two" } }],
      },
      {
        id: "WS-3",
        name: "Closed",
        color: "green",
        isOpen: false,
        isActive: false,
        tabs: [{ tabId: "T-3", isActive: true, systemTitle: "Shell" }],
        grids: [{ tabId: "T-3", pane: { workingDir: "C:\\three" } }],
      },
    ];

    it("reopens every workspace that was open and selects the one that was active", async () => {
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );

      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      });

      expect(service.getWorkspaceById("WS-1")?.isOpen).toBe(true);
      expect(gridListService.terminalIdsForWorkspace("WS-1")).toHaveLength(1);
      expect(tabListService.getTabConfigs("WS-1").map((tab) => tab.tabId)).toEqual(["T-1"]);
      expect(service.getWorkspaceById("WS-3")?.isOpen).toBe(false);
      expect(gridListService.terminalIdsForWorkspace("WS-3")).toEqual([]);
      expect(getSingleTerminalId(gridListService)).toBe(
        gridListService.terminalIdsForWorkspace("WS-2")[0],
      );
      // The default workspace is still there, just not open.
      expect(service.getWorkspaceById("WS-DEFAULT")?.isOpen).toBe(false);
    });

    it("brings nothing back when session restore is off", async () => {
      restoreSettings.enabled = false;
      const saveOpenState = workspaceRepository.saveOpenState as ReturnType<typeof vi.fn>;
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue([
        ...threeWorkspaces(),
        {
          id: "WS-DEFAULT",
          name: "Default Workspace",
          color: "grey",
          isOpen: true,
          tabs: [{ tabId: "T-OLD", isActive: true, userTitle: "from a restored session" }],
          grids: [{ tabId: "T-OLD", pane: { workingDir: "C:\\old" } }],
        },
      ]);

      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-DEFAULT");
      });

      // The launch starts in a fresh default workspace; nothing else is opened.
      expect(tabListService.getTabConfigs("WS-DEFAULT").map((tab) => tab.tabId)).not.toContain(
        "T-OLD",
      );
      for (const id of ["WS-1", "WS-2", "WS-3"]) {
        expect(service.getWorkspaceById(id)?.isOpen).toBe(false);
        expect(gridListService.terminalIdsForWorkspace(id)).toEqual([]);
      }
      expect(saveOpenState).not.toHaveBeenCalled();

      // A saved workspace is still there to be opened by hand.
      await service.restoreWorkspaceById("WS-3");
      expect(service.getActiveWorkspace()?.id).toBe("WS-3");
      expect(saveOpenState).not.toHaveBeenCalled();
    });

    it("starts a further window fresh and never lets it touch the saved session", async () => {
      appWindow.isMain = false;
      const saveOpenState = workspaceRepository.saveOpenState as ReturnType<typeof vi.fn>;
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );

      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-DEFAULT");
      });

      for (const id of ["WS-1", "WS-2", "WS-3"]) {
        expect(service.getWorkspaceById(id)?.isOpen).toBe(false);
      }
      expect(appWindow.claimWorkspace).not.toHaveBeenCalled();

      // Its own default workspace is not written over the main window's.
      await service.autoPersistWorkspace("WS-DEFAULT");
      expect(workspaceRepository.upsertWorkspace).not.toHaveBeenCalled();
      expect(saveOpenState).not.toHaveBeenCalled();
    });

    it("claims the workspaces it opens and releases them when they close", async () => {
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );
      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      });
      expect(appWindow.claimWorkspace.mock.calls.map(([id]) => id).sort()).toEqual([
        "WS-1",
        "WS-2",
      ]);

      await service.closeWorkspace("WS-1");
      expect(appWindow.releaseWorkspace).toHaveBeenCalledWith("WS-1");
    });

    it("leaves a workspace alone that another window holds", async () => {
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );
      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      });

      appWindow.claimWorkspace.mockResolvedValue(false);
      await service.restoreWorkspaceById("WS-3");

      expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      expect(service.getWorkspaceById("WS-3")?.isOpen).toBe(false);
      expect(gridListService.terminalIdsForWorkspace("WS-3")).toEqual([]);
    });

    it("records which workspaces are open and which is active as that changes", async () => {
      const saveOpenState = workspaceRepository.saveOpenState as ReturnType<typeof vi.fn>;
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );
      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      });
      expect(saveOpenState).toHaveBeenLastCalledWith(["WS-1", "WS-2"], "WS-2");

      await service.restoreWorkspaceById("WS-3");
      expect(saveOpenState).toHaveBeenLastCalledWith(["WS-1", "WS-2", "WS-3"], "WS-3");

      await service.closeWorkspace("WS-1");
      expect(saveOpenState).toHaveBeenLastCalledWith(["WS-2", "WS-3"], "WS-3");
    });

    it("persists every open workspace on quit, not only the active one", async () => {
      const persistWorkspace = (
        service as unknown as { sessionPersistence: { persistWorkspace: ReturnType<typeof vi.fn> } }
      ).sessionPersistence.persistWorkspace;
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
        threeWorkspaces(),
      );
      bus.publish({ type: "DBInitialized" });
      await vi.waitFor(() => {
        expect(service.getActiveWorkspace()?.id).toBe("WS-2");
      });
      persistWorkspace.mockClear();

      await service.persistOpenWorkspaces();

      expect(persistWorkspace.mock.calls.map((call) => call[0]).sort()).toEqual(["WS-1", "WS-2"]);
    });
  });

  it("clears the stored restore data and the snapshots waiting in memory", async () => {
    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getActiveWorkspace()?.id).toBe("WS-1");
    });
    const terminalsBefore = gridListService.terminalIdsForWorkspace("WS-1");

    await service.clearRestoreData();

    // In memory first: a pending snapshot would be written back by the next save.
    expect(forgetPendingSnapshots).toHaveBeenCalledTimes(1);
    expect(clearRestoreDataInDb).toHaveBeenCalledWith("WS-DEFAULT");
    expect(forgetPendingSnapshots.mock.invocationCallOrder[0]).toBeLessThan(
      clearRestoreDataInDb.mock.invocationCallOrder[0],
    );
    // The running session is left alone.
    expect(service.getActiveWorkspace()?.id).toBe("WS-1");
    expect(gridListService.terminalIdsForWorkspace("WS-1")).toEqual(terminalsBefore);
  });

  it("marks the session for deletion and keeps saving as usual in this run", async () => {
    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getActiveWorkspace()?.id).toBe("WS-1");
    });

    await service.clearRestoreData();
    expect(discardSessionMarker.set).toHaveBeenCalledTimes(1);

    // No hidden pause: the auto-save still stores layout and snapshots.
    await service.autoPersistWorkspace("WS-1");
    expect(workspaceRepository.upsertWorkspace).toHaveBeenCalled();
    expect(persistWorkspaceSnapshots).toHaveBeenCalledWith("WS-1");
  });

  it("deletes a marked session at launch, before anything is loaded", async () => {
    discardSessionMarker.isSet = true;

    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getActiveWorkspace()).toBeDefined();
    });

    expect(clearRestoreDataInDb).toHaveBeenCalledWith("WS-DEFAULT");
    expect(clearRestoreDataInDb.mock.invocationCallOrder[0]).toBeLessThan(
      (workspaceRepository.getAllWorkspaces as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0],
    );
    expect(discardSessionMarker.clear).toHaveBeenCalledTimes(1);
  });

  it("leaves a marked session to the main window", async () => {
    discardSessionMarker.isSet = true;
    appWindow.isMain = false;

    bus.publish({ type: "DBInitialized" });
    await vi.waitFor(() => {
      expect(service.getActiveWorkspace()).toBeDefined();
    });

    expect(clearRestoreDataInDb).not.toHaveBeenCalled();
    expect(discardSessionMarker.clear).not.toHaveBeenCalled();
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
