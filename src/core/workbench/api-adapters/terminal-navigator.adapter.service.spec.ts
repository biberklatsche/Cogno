import type { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { TabListService } from "@cogno/core/workbench/tab-list/+state/tab-list.service";
import type { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { describe, expect, it, vi } from "vitest";
import { TerminalNavigatorAdapterService } from "./terminal-navigator.adapter.service";

describe("TerminalNavigatorAdapterService", () => {
  function navigatorWith(activeWorkspaceId: string) {
    const gridListService = {
      findWorkspaceIdentifierByTerminalId: vi.fn(() => "workspace-2"),
      findTabIdByTerminalId: vi.fn(() => "tab-2"),
      findShellNameByTerminalId: vi.fn(() => "Git Bash"),
      findHostByTerminalId: vi.fn((): string | undefined => undefined),
      deferFocusTo: vi.fn(),
    };
    const tabListService = { selectTab: vi.fn() };
    const workspace = { id: "workspace-2" };
    const workspaces = {
      getActiveWorkspace: vi.fn(() => ({ id: activeWorkspaceId })),
      getWorkspaceById: vi.fn(() => workspace),
      restoreWorkspace: vi.fn().mockResolvedValue(undefined),
    };
    const bus = { publish: vi.fn() };
    const navigator = new TerminalNavigatorAdapterService(
      gridListService as unknown as GridListService,
      tabListService as unknown as TabListService,
      workspaces as unknown as WorkspaceHostApplicationService,
      bus as unknown as AppBus,
    );
    return { navigator, gridListService, tabListService, workspaces, workspace, bus };
  }

  it("switches workspaces the way the user does, then shows and focuses the terminal", async () => {
    const { navigator, gridListService, tabListService, workspaces, workspace } =
      navigatorWith("workspace-1");

    await navigator.navigateToTerminal("terminal-7");

    expect(workspaces.restoreWorkspace).toHaveBeenCalledWith(workspace);
    expect(tabListService.selectTab).toHaveBeenCalledWith("tab-2");
    expect(gridListService.deferFocusTo).toHaveBeenCalledWith("terminal-7");
  });

  it("stays in the workspace when the terminal is already in it", async () => {
    const { navigator, workspaces } = navigatorWith("workspace-2");

    await navigator.navigateToTerminal("terminal-7");

    expect(workspaces.restoreWorkspace).not.toHaveBeenCalled();
  });

  it("opens a tab in the folder with the terminal's shell, in the terminal's workspace", async () => {
    const { navigator, workspaces, workspace, bus } = navigatorWith("workspace-1");

    await navigator.openTabAt("C:/repo-feature", "terminal-7");

    expect(workspaces.restoreWorkspace).toHaveBeenCalledWith(workspace);
    expect(bus.publish).toHaveBeenCalledWith({
      type: "CreateTab",
      payload: expect.objectContaining({
        shellName: "Git Bash",
        workingDir: "C:/repo-feature",
        isActive: true,
      }),
    });
  });

  it("opens the tab on the machine the terminal runs on", async () => {
    const { navigator, gridListService, bus } = navigatorWith("workspace-2");
    gridListService.findHostByTerminalId.mockReturnValue("build-server");

    await navigator.openTabAt("/srv/repo-feature", "terminal-7");

    expect(bus.publish).toHaveBeenCalledWith({
      type: "CreateTab",
      payload: expect.objectContaining({ host: "build-server", workingDir: "/srv/repo-feature" }),
    });
  });
});
