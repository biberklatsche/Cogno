import type { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import type { GridListService } from "@cogno/core/workbench/grid-list/+state/grid-list.service";
import type { WorkspaceHostApplicationService } from "@cogno/core/workbench/workspace/workspace-host-application.service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDestroyRef } from "../../../../__test__/destroy-ref";
import { NotificationTargetRuntimeService } from "./notification-target-runtime.service";

describe("NotificationTargetRuntimeService", () => {
  let appBus: AppBus;
  let restoreWorkspaceById: ReturnType<typeof vi.fn>;
  let navigateToTerminal: ReturnType<typeof vi.fn>;
  let service: NotificationTargetRuntimeService;

  const unavailable = expect.objectContaining({
    type: "Notification",
    payload: expect.objectContaining({
      header: "Notification target unavailable",
      body: "The terminal no longer exists.",
      channels: { app: true, os: false },
    }),
  });

  beforeEach(() => {
    appBus = new AppBus();
    restoreWorkspaceById = vi.fn().mockResolvedValue(undefined);
    navigateToTerminal = vi.fn().mockResolvedValue(undefined);
    const gridListService = {
      getGridConfigs: vi.fn((workspaceId?: string) =>
        workspaceId === "workspace-1" ? [{ tabId: "tab-1", pane: {} }] : [],
      ),
      // terminal-1 now lives in tab-2: it moved after the notification was sent.
      findTabIdByTerminalId: vi.fn((terminalId: string) =>
        terminalId === "terminal-1" ? "tab-2" : undefined,
      ),
    } as unknown as GridListService;
    service = new NotificationTargetRuntimeService(
      appBus,
      gridListService,
      { restoreWorkspaceById } as unknown as WorkspaceHostApplicationService,
      { navigateToTerminal } as unknown as TerminalNavigator,
      getDestroyRef(),
    );
  });

  it("goes to the notification's terminal wherever it is now", async () => {
    await service.openTarget({
      workspaceId: "workspace-1",
      tabId: "tab-1",
      terminalId: "terminal-1",
    });

    expect(navigateToTerminal).toHaveBeenCalledWith("terminal-1");
  });

  it("says so when the notification's terminal is gone", async () => {
    const publish = vi.spyOn(appBus, "publish");

    await service.openTarget({
      workspaceId: "workspace-1",
      tabId: "tab-1",
      terminalId: "closed-terminal",
    });

    expect(navigateToTerminal).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(unavailable);
  });

  it("opens the tab of a target without a terminal", async () => {
    const publish = vi.spyOn(appBus, "publish");

    await service.openTarget({ workspaceId: "workspace-1", tabId: "tab-1" });

    expect(restoreWorkspaceById).toHaveBeenCalledWith("workspace-1");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SelectTab", payload: "tab-1" }),
    );
  });

  it("says so when a target's tab is gone", async () => {
    const publish = vi.spyOn(appBus, "publish");

    await service.openTarget({ workspaceId: "missing-workspace", tabId: "tab-1" });

    expect(publish).toHaveBeenCalledWith(unavailable);
  });
});
