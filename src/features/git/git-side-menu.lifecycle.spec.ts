import { signal } from "@angular/core";
import type { SideMenuFeatureHandleContract } from "@cogno/core/api/contributions";
import { describe, expect, it, vi } from "vitest";
import type { GitRepositoriesOverviewService } from "./git-repositories-overview.service";
import type { GitRepositoryService } from "./git-repository.service";
import { GitSideMenuLifecycle } from "./git-side-menu.lifecycle";
import type { GitViewState } from "./git-view-state.service";

describe("GitSideMenuLifecycle", () => {
  function setUp(state: {
    marks: boolean;
    diff: boolean;
    newBranchAt?: string;
    refsFilter?: string;
  }) {
    let onEscape: () => void = () => {};
    const handle = {
      registerKeybindListener: (_keys: string[], handler: () => void) => {
        onEscape = handler;
      },
      close: vi.fn(),
    } as unknown as SideMenuFeatureHandleContract;
    const view = {
      newBranchAt: signal<string | null>(state.newBranchAt ?? null),
      refsFilter: signal(state.refsFilter ?? ""),
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
      {} as GitRepositoriesOverviewService,
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

  it("lets Escape first end the branch name being typed, then clear the filter", () => {
    const { pressEscape, view, handle } = setUp({
      marks: true,
      diff: false,
      newBranchAt: "c1",
      refsFilter: "feat",
    });

    pressEscape();
    expect(view.newBranchAt()).toBeNull();
    expect(view.refsFilter()).toBe("feat");

    pressEscape();
    expect(view.refsFilter()).toBe("");
    expect(view.clearMarks).not.toHaveBeenCalled();

    pressEscape();
    expect(view.clearMarks).toHaveBeenCalled();
    expect(handle.close).not.toHaveBeenCalled();
  });
});
