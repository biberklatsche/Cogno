import type { WorkspaceHostPort } from "@cogno/core-api";
import { of } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../../features/__test__/destroy-ref";
import { AppBus } from "../../app-bus/app-bus";
import type { GridListService } from "../../grid-list/+state/grid-list.service";
import { NotificationTargetRuntimeService } from "./notification-target-runtime.service";

describe("NotificationTargetRuntimeService", () => {
  let appBus: AppBus;
  let gridListService: GridListService;
  let workspaceHostPort: WorkspaceHostPort;
  let restoreWorkspaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appBus = new AppBus();
    vi.stubGlobal("requestAnimationFrame", undefined);
    gridListService = {
      getGridConfigs: vi.fn((workspaceId?: string) =>
        workspaceId === "workspace-1" ? [{ tabId: "tab-1", pane: {} }] : [],
      ),
      findWorkspaceIdentifierByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "workspace-1" : undefined,
      ),
      findTabIdByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "tab-1" : undefined,
      ),
    } as unknown as GridListService;
    restoreWorkspaceMock = vi.fn().mockResolvedValue(undefined);
    workspaceHostPort = {
      workspaceEntries$: of([{ id: "workspace-1", name: "Workspace 1" }]),
      restoreWorkspace: restoreWorkspaceMock,
      closeWorkspace: vi.fn(),
      reorderWorkspaces: vi.fn(),
      persistWorkspaceOrder: vi.fn(),
      openCreateWorkspaceDialog: vi.fn(),
      openEditWorkspaceDialog: vi.fn(),
      deleteWorkspace: vi.fn(),
    };
  });

  it("restores the workspace and then selects and focuses the notification target", async () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    const service = new NotificationTargetRuntimeService(
      appBus,
      gridListService,
      workspaceHostPort,
      getDestroyRef(),
    );

    await service.openTarget({
      workspaceId: "workspace-1",
      tabId: "tab-1",
      terminalId: "terminal-1",
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(restoreWorkspaceMock).toHaveBeenCalledWith("workspace-1");
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SelectTab",
        payload: "tab-1",
      }),
    );
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["app", "terminal"],
        type: "FocusTerminal",
        payload: "terminal-1",
      }),
    );
  });

  it("shows an app notification when the target workspace no longer exists", async () => {
    const publishSpy = vi.spyOn(appBus, "publish");
    const service = new NotificationTargetRuntimeService(
      appBus,
      gridListService,
      {
        ...workspaceHostPort,
        workspaceEntries$: of([]),
      },
      getDestroyRef(),
    );

    await service.openTarget({
      workspaceId: "missing-workspace",
      tabId: "tab-1",
      terminalId: "terminal-1",
    });

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ["notification"],
        type: "Notification",
        payload: expect.objectContaining({
          header: "Notification target unavailable",
          body: "The terminal no longer exists.",
          channels: {
            app: true,
            os: false,
          },
        }),
      }),
    );
  });
});
