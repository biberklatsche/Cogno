import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  getAppBus,
  getConfigService,
  getDestroyRef,
  getGridListService,
  getSideMenuService,
  getTabListService,
} from "../../__test__/test-factory";
import type { AppBus } from "../app-bus/app-bus";
import type { Grid } from "../grid-list/+model/model";
import { GridListService } from "../grid-list/+state/grid-list.service";
import { SideMenuService } from "../menu/side-menu/+state/side-menu.service";
import { TabListService } from "../tab-list/+state/tab-list.service";
import { WorkspaceHostApplicationService } from "./workspace-host-application.service";
import type { WorkspaceRepository } from "./workspace.repository";

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
    } as unknown as WorkspaceRepository;

    service = new WorkspaceHostApplicationService(
      bus,
      sideMenuService,
      workspaceRepository,
      gridListService,
      tabListService,
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
    bus.publish({ type: "TerminalFocused", payload: terminalId });
    bus.publish({
      type: "TerminalTitleChanged",
      payload: { oscCode: 0, terminalId, title: "pwsh" },
    });

    expect(service.getWorkspaceById("WS-1")?.isDirty).toBe(false);
  });

  it("marks a workspace dirty when the working directory changes", async () => {
    bus.publish({ type: "DBInitialized" });

    await vi.waitFor(() => {
      expect(getSingleTerminalId(gridListService)).toBeTruthy();
    });
    const terminalId = getSingleTerminalId(gridListService);
    bus.publish({
      type: "TerminalCwdChanged",
      payload: { terminalId, cwd: "C:\\other" },
    });

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
