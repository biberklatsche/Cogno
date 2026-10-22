import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { describe, expect, it, vi } from "vitest";
import type { GitRepositoryService } from "./git-repository.service";
import { GitSideMenuLifecycle } from "./git-side-menu.lifecycle";
import type { GitViewState } from "./git-view-state.service";

describe("GitSideMenuLifecycle", () => {
  function setUp(state: { marks: boolean; diff: boolean }) {
    let onEscape: () => void = () => {};
    const handle = {
      registerKeybindListener: (_keys: string[], handler: () => void) => {
        onEscape = handler;
      },
      unregisterKeybindListener: vi.fn(),
      close: vi.fn(),
    } as unknown as SideMenuFeatureHandleContract<string>;
    const view = {
      hasMarks: () => state.marks,
      clearMarks: vi.fn(() => {
        state.marks = false;
      }),
      diff: () => (state.diff ? {} : null),
      closeDiff: vi.fn(() => {
        state.diff = false;
      }),
    };
    const lifecycle = new GitSideMenuLifecycle(
      {} as GitRepositoryService,
      view as unknown as GitViewState,
    ).create(handle);
    lifecycle.onFocus?.();
    return { pressEscape: () => onEscape(), view, handle };
  }

  it("lets Escape clear marked branches, then close the diff, then the panel", () => {
    const { pressEscape, view, handle } = setUp({ marks: true, diff: true });

    pressEscape();
    expect(view.clearMarks).toHaveBeenCalled();
    expect(view.closeDiff).not.toHaveBeenCalled();

    pressEscape();
    expect(view.closeDiff).toHaveBeenCalled();
    expect(handle.close).not.toHaveBeenCalled();

    pressEscape();
    expect(handle.close).toHaveBeenCalled();
  });
});
