import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  untracked,
} from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitDiffContent, GitDiffService, GitDiffSource, GitTextSource } from "../git-diff.service";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState } from "../git-view-state.service";
import { GitFile } from "../model/git-model";
import { GitPatch } from "../model/git-patch";
import { GitConflictViewComponent } from "./git-conflict-view.component";
import { GitDiffViewComponent } from "./git-diff-view.component";
import { fileStatusClass, fileStatusIcon } from "./git-format";
import { GitHunkActions, GitHunkViewComponent } from "./git-hunk-view.component";
import { GIT_SHARED_STYLES } from "./git-styles";
import { PacedLoad } from "./paced-load";

/**
 * A file's diff in the middle of the panel, in place of the graph: hunk by
 * hunk with stage, unstage and discard down to single lines, or split or
 * inline for reading. It follows the file when it moves between the unstaged
 * and staged lists.
 */
@Component({
  selector: "app-git-diff-panel",
  standalone: true,
  imports: [
    IconComponent,
    TooltipDirective,
    GitConflictViewComponent,
    GitDiffViewComponent,
    GitHunkViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view.diff(); as source) {
      <header class="panel-header">
        <app-icon [class]="'small-icon ' + statusClass(source)" [name]="statusIcon(source)"></app-icon>
        <span class="ellipsis path" [appTooltip]="source.file.path">
          @if (source.file.oldPath) {
            <span class="subtle">{{ source.file.oldPath }} → </span>
          }
          {{ source.file.path }}
        </span>
        <span class="subtle origin">{{ origin(source) }}</span>
        <span class="grow"></span>
        @if (source.kind === "unstaged") {
          <button type="button" class="button small" (click)="operations.stage([source.file.path])">Stage File</button>
        } @else if (source.kind === "staged") {
          <button type="button" class="button small" (click)="operations.unstage([source.file.path])">Unstage File</button>
        }
        @if (source.kind !== "conflicted") {
          <div class="mode">
            <button type="button" class="button icon-button" appTooltip="Hunk View"
                    [class.active]="view.diffMode() === 'hunks'" (click)="view.diffMode.set('hunks')">
              <app-icon name="mdiViewSequential"></app-icon>
            </button>
            <button type="button" class="button icon-button" appTooltip="Split View"
                    [class.active]="view.diffMode() === 'split'" (click)="view.diffMode.set('split')">
              <app-icon name="mdiViewSplitVertical"></app-icon>
            </button>
            <button type="button" class="button icon-button" appTooltip="Inline View"
                    [class.active]="view.diffMode() === 'unified'" (click)="view.diffMode.set('unified')">
              <app-icon name="mdiViewAgenda"></app-icon>
            </button>
          </div>
        }
        @if (source.file.status !== "D") {
          <button type="button" class="button icon-button" appTooltip="Open file" (click)="actions.openFile(source.file)">
            <app-icon name="mdiOpenInNew"></app-icon>
          </button>
        }
        <button type="button" class="button icon-button" appTooltip="Close diff (Esc)" (click)="view.closeDiff()">
          <app-icon name="mdiClose"></app-icon>
        </button>
      </header>
      <div class="diff-body">
        @if (source.kind === "conflicted") {
          <app-git-conflict-view [path]="source.file.path"></app-git-conflict-view>
        } @else if (view.diffMode() === "hunks") {
          @if (patch(); as patch) {
            <app-git-hunk-view [patch]="patch" [actions]="hunkActions(source)" [emptyText]="emptyText(source)"
                               (stage)="actions.stageHunk(patch, $event.hunk, $event.lines)"
                               (unstage)="actions.unstageHunk(patch, $event.hunk, $event.lines)"
                               (discard)="actions.discardHunk(patch, $event.hunk, $event.lines)"></app-git-hunk-view>
          } @else {
            <div class="empty"><app-icon class="small-icon spin" name="mdiLoading"></app-icon> Loading diff…</div>
          }
        } @else if (content(); as diff) {
          @if (diff.original === diff.modified) {
            <div class="empty">No text changes (binary file, mode or rename only)</div>
          } @else {
            <app-git-diff-view [diff]="diff" [mode]="view.diffMode()"></app-git-diff-view>
          }
        } @else {
          <div class="empty"><app-icon class="small-icon spin" name="mdiLoading"></app-icon> Loading diff…</div>
        }
      </div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host { display: flex; flex-direction: column; min-height: 0; min-width: 0; height: 100%; }
      .path { flex: 0 1 auto; }
      .origin { flex: 0 0 auto; font-size: var(--git-font-small); }
      .mode { display: flex; gap: 2px; }
      .mode .active { background: var(--git-hover); }
      .diff-body { flex: 1 1 auto; position: relative; min-height: 0; overflow: hidden; }
    `,
  ],
})
export class GitDiffPanelComponent {
  readonly content = signal<GitDiffContent | null>(null);
  readonly patch = signal<GitPatch | null>(null);
  private loadedKey: string | null = null;
  private readonly paced = new PacedLoad();
  private readonly sourceKey = computed(() => {
    const source = this.view.diff();
    if (!source) return null;
    return source.kind === "commit"
      ? `commit:${source.sha}:${source.file.path}`
      : `${source.kind}:${source.file.path}`;
  });

  constructor(
    readonly view: GitViewState,
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    private readonly diffs: GitDiffService,
  ) {
    // Load when another file is opened or the view switches between hunks and
    // text, and reload a working-tree diff whenever the repository was re-read
    // (the file may have changed on disk).
    effect((onCleanup) => {
      const key = this.sourceKey();
      const hunks = this.view.diffMode() === "hunks";
      const source = untracked(() => this.view.diff());
      if (source?.kind !== "commit") this.repository.status();
      if (!key || !source || source.kind === "conflicted") return;
      untracked(() => {
        // What is shown belongs to the file before; the new one is read once
        // the selection rests.
        if (key !== this.loadedKey) {
          this.patch.set(null);
          this.content.set(null);
        }
        this.paced.start(() => void this.load(source, key, hunks));
      });
      onCleanup(() => this.paced.cancel());
    });

    // A file moves between the lists (staged, unstaged, resolved); the panel
    // follows it to the list it is in now, or closes.
    effect(() => {
      const status = this.repository.status();
      const source = untracked(() => this.view.diff());
      if (!source || source.kind === "commit") return;
      const path = source.file.path;
      const find = (files: ReadonlyArray<GitFile>) => files.find((f) => f.path === path);
      const now: ReadonlyArray<GitDiffSource> = [
        ...this.sourceIn("conflicted", find(status.conflicted)),
        ...this.sourceIn("staged", find(status.staged)),
        ...this.sourceIn("unstaged", find([...status.unstaged, ...status.untracked])),
      ];
      if (now.some((candidate) => candidate.kind === source.kind)) return;
      untracked(() => {
        const next = now[0];
        if (next) this.view.openDiff(next);
        else this.view.closeDiff();
      });
    });
  }

  hunkActions(source: GitTextSource): GitHunkActions {
    if (source.kind === "commit") return "none";
    return source.kind;
  }

  emptyText(source: GitDiffSource): string {
    if (source.file.status === "?") return "Untracked file - stage it as a whole";
    return "No text changes (mode or rename only)";
  }

  origin(source: GitDiffSource): string {
    if (source.kind === "commit") return source.sha.slice(0, 7);
    if (source.kind === "conflicted") return "Conflicted";
    return source.kind === "staged" ? "Staged" : "Unstaged";
  }

  statusIcon(source: GitDiffSource) {
    return fileStatusIcon(source.file);
  }

  statusClass(source: GitDiffSource): string {
    return fileStatusClass(source.file);
  }

  /**
   * Read the file as hunks or as text. A re-read of the same file keeps the
   * last result on screen meanwhile; another file starts blank.
   */
  /** The source for a file found in one of the working-tree lists. */
  private sourceIn(
    kind: "conflicted" | "staged" | "unstaged",
    file: GitFile | undefined,
  ): GitDiffSource[] {
    return file ? [{ kind, file }] : [];
  }

  private async load(source: GitTextSource, key: string, hunks: boolean): Promise<void> {
    if (hunks) {
      const patch = await this.diffs.loadPatch(source);
      if (!this.stillShowing(key, hunks)) return;
      this.patch.set(patch);
    } else {
      const content = await this.diffs.loadDiff(source);
      if (!this.stillShowing(key, hunks)) return;
      // The same text again (a status refresh): leave the editor alone.
      const current = this.content();
      if (current?.original !== content.original || current.modified !== content.modified) {
        this.content.set(content);
      }
    }
    this.loadedKey = key;
  }

  /** False when another file was opened or the view switched while git was reading. */
  private stillShowing(key: string, hunks: boolean): boolean {
    return key === this.sourceKey() && hunks === (this.view.diffMode() === "hunks");
  }
}
