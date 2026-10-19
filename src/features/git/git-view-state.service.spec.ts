import { signal } from "@angular/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { GitRepositoryService } from "./git-repository.service";
import { GitViewState } from "./git-view-state.service";

describe("GitViewState", () => {
  let changeCount: ReturnType<typeof signal<number>>;
  let head: ReturnType<typeof signal<{ sha: string | null; branch: string | null }>>;
  let view: GitViewState;

  beforeEach(() => {
    window.localStorage.clear();
    changeCount = signal(2);
    head = signal({ sha: "abc123", branch: "main" });
    view = new GitViewState({ changeCount, head } as unknown as GitRepositoryService);
  });

  it("shows the work in progress row and selects it while there are changes", () => {
    expect(view.wipVisible()).toBe(true);
    expect(view.selection()).toEqual({ kind: "wip" });
  });

  it("hides the row and stands in with HEAD while there is nothing to commit", () => {
    changeCount.set(0);

    expect(view.wipVisible()).toBe(false);
    expect(view.selection()).toEqual({ kind: "commit", sha: "abc123" });
  });

  it("is back on the row as soon as there are changes again", () => {
    changeCount.set(0);
    changeCount.set(1);

    expect(view.selection()).toEqual({ kind: "wip" });
  });

  it("keeps the row in an empty repository without a commit to show", () => {
    changeCount.set(0);
    head.set({ sha: null, branch: null });

    expect(view.wipVisible()).toBe(true);
    expect(view.selection()).toEqual({ kind: "wip" });
  });

  it("leaves an explicitly selected commit alone", () => {
    view.select({ kind: "commit", sha: "def456" });
    changeCount.set(0);

    expect(view.selection()).toEqual({ kind: "commit", sha: "def456" });
  });

  it("brings the panel's arrangement back after a restart", () => {
    view.hiddenColumns.set(new Set(["sha", "date"]));
    view.columnWidths.update((widths) => ({ ...widths, author: 200 }));
    view.closedSections.update((closed) => new Set([...closed, "tags"]));
    view.diffMode.set("split");
    view.refsVisible.set(false);

    const restarted = new GitViewState({ changeCount, head } as unknown as GitRepositoryService);

    expect([...restarted.hiddenColumns()]).toEqual(["sha", "date"]);
    expect(restarted.columnWidths()).toEqual({ author: 200 });
    expect([...restarted.closedSections()]).toEqual(["tags"]);
    expect(restarted.diffMode()).toBe("split");
    expect(restarted.refsVisible()).toBe(false);
  });

  it("does not carry the selection or an open diff across a restart", () => {
    view.select({ kind: "commit", sha: "def456" });
    view.diffMode.set("unified");

    const restarted = new GitViewState({ changeCount, head } as unknown as GitRepositoryService);

    expect(restarted.selection()).toEqual({ kind: "wip" });
    expect(restarted.diff()).toBeNull();
  });
});
