import { computed, Injectable, signal, WritableSignal } from "@angular/core";
import { GitDiffSource } from "./git-diff.service";
import { GitPullMode } from "./git-operations.service";
import { GitRepositoryService } from "./git-repository.service";
import { GitRowMarks } from "./ui/git-row-marks";

/** What the detail panel on the right shows. */
export type GitSelection =
  | { readonly kind: "wip" }
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "stash"; readonly sha: string; readonly ref: string };

export type GitDiffMode = "hunks" | "split" | "unified";
/** The graph columns the user can resize; the message column takes the rest. */
export type GitGraphColumn = "refs" | "graph" | "author" | "date" | "sha";
export type GitFileListMode = "path" | "tree";
/** The side panels of the git view the user can resize. */
export type GitSidePanel = "refs" | "detail";
/** Which list a working-tree file is in. */
export type GitWipFileGroup = "unstaged" | "staged" | "conflicted";
/** The collapsible sections of the refs panel. */
export type GitRefsSection = "local" | "remote" | "stashes" | "tags";

const STORAGE_KEY = "cogno.git.view";

/** What survives a restart: how the panel is arranged, not what is selected. */
type StoredView = {
  readonly diffMode?: GitDiffMode;
  readonly fileListMode?: GitFileListMode;
  readonly refsVisible?: boolean;
  readonly pullMode?: GitPullMode;
  readonly columnWidths?: Readonly<Partial<Record<GitGraphColumn, number>>>;
  readonly hiddenColumns?: ReadonlyArray<GitGraphColumn>;
  readonly closedSections?: ReadonlyArray<GitRefsSection>;
  readonly closedWipGroups?: ReadonlyArray<GitWipFileGroup>;
  readonly panelWidths?: Readonly<Partial<Record<GitSidePanel, number>>>;
};

/**
 * The panel's view state, shared by its parts: what is selected, which file
 * diff replaces the graph in the middle, and how files and diffs are shown.
 * It outlives the panel component, so closing and reopening the panel keeps
 * the user's place.
 */
@Injectable({ providedIn: "root" })
export class GitViewState {
  private readonly chosen = signal<GitSelection>({ kind: "wip" });
  /**
   * The "Work in progress" row is only shown while there is something to
   * commit, as in GitKraken. An empty repository keeps it: there is no commit
   * to show instead.
   */
  readonly wipVisible = computed(
    () => this.repository.changeCount() > 0 || this.repository.head().sha === null,
  );
  /**
   * What is selected. A chosen "work in progress" stands for HEAD while the row
   * is hidden, so it is back in place as soon as there are changes again.
   */
  readonly selection = computed<GitSelection>(() => {
    const chosen = this.chosen();
    const head = this.repository.head().sha;
    return chosen.kind === "wip" && head !== null && !this.wipVisible()
      ? { kind: "commit", sha: head }
      : chosen;
  });
  /** The open diff; while set, it takes the graph's place. */
  readonly diff = signal<GitDiffSource | null>(null);
  private readonly stored = readStored();
  readonly diffMode = this.persistent<GitDiffMode>(this.stored.diffMode ?? "hunks");
  readonly fileListMode = this.persistent<GitFileListMode>(this.stored.fileListMode ?? "path");
  readonly refsVisible = this.persistent(this.stored.refsVisible ?? true);
  /** What the Pull button does; chosen in its menu, as in GitKraken. */
  readonly pullMode = this.persistent<GitPullMode>(this.stored.pullMode ?? "merge");
  /** Column widths the user dragged, in pixels; a column not listed has its default. */
  readonly columnWidths = this.persistent<Readonly<Partial<Record<GitGraphColumn, number>>>>(
    this.stored.columnWidths ?? {},
  );
  /** Columns the user switched off; the message column cannot be. */
  readonly hiddenColumns = this.persistent<ReadonlySet<GitGraphColumn>>(
    new Set(this.stored.hiddenColumns ?? []),
  );
  /** Side panel widths the user dragged, in pixels; a panel not listed has its default. */
  readonly panelWidths = this.persistent<Readonly<Partial<Record<GitSidePanel, number>>>>(
    this.stored.panelWidths ?? {},
  );
  /** The refs panel sections the user folded. */
  readonly closedSections = this.persistent<ReadonlySet<GitRefsSection>>(
    new Set(this.stored.closedSections ?? []),
  );
  /** The file groups of the work-in-progress panel the user folded. */
  readonly closedWipGroups = this.persistent<ReadonlySet<GitWipFileGroup>>(
    new Set(this.stored.closedWipGroups ?? []),
  );
  /** The commit a new branch is being named at, inline in its graph row. */
  readonly newBranchAt = signal<string | null>(null);
  /** A commit the graph should scroll to; cleared by the graph once it did. */
  readonly reveal = signal<string | null>(null);
  /** Branches marked in the refs panel for one action on all of them. */
  readonly localMarks = new GitRowMarks();
  readonly remoteMarks = new GitRowMarks();

  constructor(private readonly repository: GitRepositoryService) {}

  select(selection: GitSelection): void {
    this.chosen.set(selection);
    this.diff.set(null);
  }

  /** Select a commit and bring it into view in the graph. */
  revealCommit(sha: string): void {
    this.select({ kind: "commit", sha });
    this.reveal.set(sha);
  }

  hasMarks(): boolean {
    return this.localMarks.names().size > 0 || this.remoteMarks.names().size > 0;
  }

  clearMarks(): void {
    this.localMarks.clear();
    this.remoteMarks.clear();
  }

  openDiff(source: GitDiffSource): void {
    this.diff.set(source);
  }

  closeDiff(): void {
    this.diff.set(null);
  }

  /** A signal whose every change is written to storage along with the other persistent ones. */
  private persistent<T>(initial: T): WritableSignal<T> {
    const inner = signal<T>(initial);
    const set = inner.set;
    const update = inner.update;
    inner.set = (value) => {
      set.call(inner, value);
      this.save();
    };
    inner.update = (fn) => {
      update.call(inner, fn);
      this.save();
    };
    return inner;
  }

  private save(): void {
    const view: StoredView = {
      diffMode: this.diffMode(),
      fileListMode: this.fileListMode(),
      refsVisible: this.refsVisible(),
      pullMode: this.pullMode(),
      columnWidths: this.columnWidths(),
      hiddenColumns: [...this.hiddenColumns()],
      closedSections: [...this.closedSections()],
      closedWipGroups: [...this.closedWipGroups()],
      panelWidths: this.panelWidths(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
      // No storage (blocked site data): the arrangement lasts for this run only.
    }
  }
}

function readStored(): StoredView {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as StoredView) : {};
  } catch {
    return {};
  }
}
