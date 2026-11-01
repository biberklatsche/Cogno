import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceSideMenuLifecycle } from "./workspace-side-menu.lifecycle";

type SideMenuFeatureHandle = SideMenuFeatureHandleContract;

describe("WorkspaceSideMenuLifecycle", () => {
  let workspaceService: Pick<WorkspaceService, "restoreSelectedWorkspace" | "selectNext">;
  let handle: {
    close: ReturnType<typeof vi.fn<SideMenuFeatureHandle["close"]>>;
    registerKeybindListener: ReturnType<
      typeof vi.fn<SideMenuFeatureHandle["registerKeybindListener"]>
    >;
    updateBadgeColor: ReturnType<typeof vi.fn<SideMenuFeatureHandle["updateBadgeColor"]>>;
  };
  let lifecycle: ReturnType<WorkspaceSideMenuLifecycle["create"]>;

  beforeEach(() => {
    workspaceService = {
      restoreSelectedWorkspace: vi.fn().mockResolvedValue(undefined),
      selectNext: vi.fn(),
    };
    handle = {
      close: vi.fn<SideMenuFeatureHandle["close"]>(),
      registerKeybindListener: vi.fn<SideMenuFeatureHandle["registerKeybindListener"]>(),
      updateBadgeColor: vi.fn<SideMenuFeatureHandle["updateBadgeColor"]>(),
    };

    lifecycle = new WorkspaceSideMenuLifecycle(workspaceService as WorkspaceService).create(handle);
  });

  it("registers keyboard handling for navigation and restore, Escape stays with the host", async () => {
    lifecycle.onFocus?.();

    const [keys, listener] = vi.mocked(handle.registerKeybindListener).mock.calls[0];
    expect(keys).not.toContain("Escape");

    listener({ key: "ArrowDown" } as KeyboardEvent);
    listener({ key: "ArrowUp" } as KeyboardEvent);
    listener({ key: "ArrowLeft" } as KeyboardEvent);
    listener({ key: "ArrowRight" } as KeyboardEvent);
    listener({ key: "Enter" } as KeyboardEvent);

    await Promise.resolve();

    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(1, "down");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(2, "up");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(3, "left");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(4, "right");
    expect(workspaceService.restoreSelectedWorkspace).toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
  });
});
