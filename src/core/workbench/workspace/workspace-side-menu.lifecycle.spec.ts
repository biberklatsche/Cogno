import type { SideMenuFeatureHandleContract } from "@cogno/shared/contributions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceSideMenuLifecycle } from "./workspace-side-menu.lifecycle";

type SideMenuFeatureHandle = SideMenuFeatureHandleContract<string>;

describe("WorkspaceSideMenuLifecycle", () => {
  let workspaceService: Pick<WorkspaceService, "restoreSelectedWorkspace" | "selectNext">;
  let handle: {
    close: ReturnType<typeof vi.fn<SideMenuFeatureHandle["close"]>>;
    registerKeybindListener: ReturnType<
      typeof vi.fn<SideMenuFeatureHandle["registerKeybindListener"]>
    >;
    unregisterKeybindListener: ReturnType<
      typeof vi.fn<SideMenuFeatureHandle["unregisterKeybindListener"]>
    >;
    updateIcon: ReturnType<typeof vi.fn<SideMenuFeatureHandle["updateIcon"]>>;
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
      unregisterKeybindListener: vi.fn<SideMenuFeatureHandle["unregisterKeybindListener"]>(),
      updateIcon: vi.fn<SideMenuFeatureHandle["updateIcon"]>(),
      updateBadgeColor: vi.fn<SideMenuFeatureHandle["updateBadgeColor"]>(),
    };

    lifecycle = new WorkspaceSideMenuLifecycle(workspaceService as WorkspaceService).create(handle);
  });

  it("unregisters on off, blur and close", () => {
    lifecycle.onModeChange?.("off");
    lifecycle.onBlur?.();
    lifecycle.onClose?.();

    expect(handle.unregisterKeybindListener).toHaveBeenCalledTimes(3);
  });

  it("registers keyboard handling for navigation, closing and restore", async () => {
    lifecycle.onFocus?.();

    const listener = vi.mocked(handle.registerKeybindListener).mock.calls[0]?.[1];
    expect(listener).toBeTypeOf("function");

    listener?.({ key: "ArrowDown" } as KeyboardEvent);
    listener?.({ key: "ArrowUp" } as KeyboardEvent);
    listener?.({ key: "ArrowLeft" } as KeyboardEvent);
    listener?.({ key: "ArrowRight" } as KeyboardEvent);
    listener?.({ key: "Escape" } as KeyboardEvent);
    listener?.({ key: "Enter" } as KeyboardEvent);

    await Promise.resolve();

    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(1, "down");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(2, "up");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(3, "left");
    expect(workspaceService.selectNext).toHaveBeenNthCalledWith(4, "right");
    expect(workspaceService.restoreSelectedWorkspace).toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(2);
  });
});
