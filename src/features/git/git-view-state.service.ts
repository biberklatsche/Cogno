import { Injectable, signal } from "@angular/core";
import { GitDiffSource } from "./git-diff.service";
import { GitPullMode } from "./git-operations.service";

/** What the detail panel on the right shows. */
export type GitSelection =
  | { readonly kind: "wip" }
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "stash"; readonly sha: string; readonly ref: string };

export type GitDiffMode = "hunks" | "split" | "unified";
/** The graph columns the user can resize; the message column takes the rest. */
export type GitGraphColumn = "refs" | "graph" | "author" | "date" | "sha";
export type GitFileListMode = "path" | "tree";

/**
 * The panel's view state, shared by its parts: what is selected, which file
 * diff replaces the graph in the middle, and how files and diffs are shown.
 * It outlives the panel component, so closing and reopening the panel keeps
 * the user's place.
 */
@Injectable({ providedIn: "root" })
export class GitViewState {
  readonly selection = signal<GitSelection>({ kind: "wip" });
  /** The open diff; while set, it takes the graph's place. */
  readonly diff = signal<GitDiffSource | null>(null);
  readonly diffMode = signal<GitDiffMode>("hunks");
  readonly fileListMode = signal<GitFileListMode>("path");
  readonly refsVisible = signal(true);
  /** What the Pull button does; chosen in its menu, as in GitKraken. */
  readonly pullMode = signal<GitPullMode>("merge");
  /** Column widths the user dragged, in pixels; a column not listed has its default. */
  readonly columnWidths = signal<Readonly<Partial<Record<GitGraphColumn, number>>>>({});
  /** Columns the user switched off; the message column cannot be. */
  readonly hiddenColumns = signal<ReadonlySet<GitGraphColumn>>(new Set());
  /** The commit a new branch is being named at, inline in its graph row. */
  readonly newBranchAt = signal<string | null>(null);
  /** A commit the graph should scroll to; cleared by the graph once it did. */
  readonly reveal = signal<string | null>(null);

  select(selection: GitSelection): void {
    this.selection.set(selection);
    this.diff.set(null);
  }

  /** Select a commit and bring it into view in the graph. */
  revealCommit(sha: string): void {
    this.select({ kind: "commit", sha });
    this.reveal.set(sha);
  }

  openDiff(source: GitDiffSource): void {
    this.diff.set(source);
  }

  closeDiff(): void {
    this.diff.set(null);
  }
}
