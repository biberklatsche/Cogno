import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceSideMenuLifecycle } from "./workspace-side-menu.lifecycle";

describe("WorkspaceSideMenuLifecycle", () => {
  let workspaceService: Pick<
    WorkspaceService,
    "initializeSelection" | "restoreSelectedWorkspace" | "selectNext"
  >;
  let handle: {
    close: ReturnType<typeof vi.fn>;
    registerKeybindListener: ReturnType<typeof vi.fn>;
    unregisterKeybindListener: ReturnType<typeof vi.fn>;
  };
  let lifecycle: ReturnType<WorkspaceSideMenuLifecycle["create"]>;

  beforeEach(() => {
    workspaceService = {
      initializeSelection: vi.fn(),
      restoreSelectedWorkspace: vi.fn().mockResolvedValue(undefined),
      selectNext: vi.fn(),
    };
    handle = {
      close: vi.fn(),
      registerKeybindListener: vi.fn(),
      unregisterKeybindListener: vi.fn(),
    };

    lifecycle = new WorkspaceSideMenuLifecycle(workspaceService as WorkspaceService).create(handle);
  });

  it("initializes selection on open and unregisters on off, blur and close", () => {
    lifecycle.onOpen();
    lifecycle.onModeChange("off");
    lifecycle.onBlur();
    lifecycle.onClose();

    expect(workspaceService.initializeSelection).toHaveBeenCalled();
    expect(handle.unregisterKeybindListener).toHaveBeenCalledTimes(3);
  });

  it("registers keyboard handling for navigation, closing and restore", async () => {
    lifecycle.onFocus();

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
