import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  untracked,
} from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitDiffContent, GitDiffService, GitDiffSource } from "../git-diff.service";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState } from "../git-view-state.service";
import { GitPatch } from "../model/git-patch";
import { GitDiffViewComponent } from "./git-diff-view.component";
import { fileStatusClass, fileStatusIcon } from "./git-format";
import { GitHunkActions, GitHunkViewComponent } from "./git-hunk-view.component";
import { GIT_SHARED_STYLES } from "./git-styles";

/**
 * A file's diff in the middle of the panel, in place of the graph: hunk by
 * hunk with stage, unstage and discard down to single lines, or split or
 * inline for reading. It follows the file when it moves between the unstaged
 * and staged lists.
 */
@Component({
  selector: "app-git-diff-panel",
  standalone: true,
  imports: [IconComponent, TooltipDirective, GitDiffViewComponent, GitHunkViewComponent],
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
          <button type="button" class="button small stage" (click)="operations.stage([source.file.path])">Stage File</button>
        } @else if (source.kind === "staged") {
          <button type="button" class="button small unstage" (click)="operations.unstage([source.file.path])">Unstage File</button>
        }
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
        @if (view.diffMode() === "hunks") {
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
    effect(() => {
      const key = this.sourceKey();
      const hunks = this.view.diffMode() === "hunks";
      const source = untracked(() => this.view.diff());
      if (source?.kind !== "commit") this.repository.status();
      if (!key || !source) return;
      untracked(() => void (hunks ? this.loadPatch(source, key) : this.load(source, key)));
    });

    // A staged file moves to the other list; the diff follows it or closes.
    effect(() => {
      const status = this.repository.status();
      const source = untracked(() => this.view.diff());
      if (!source || source.kind === "commit") return;
      const path = source.file.path;
      const inUnstaged = [...status.unstaged, ...status.untracked, ...status.conflicted].find(
        (f) => f.path === path,
      );
      const inStaged = status.staged.find((f) => f.path === path);
      untracked(() => {
        if (source.kind === "unstaged" && !inUnstaged) {
          if (inStaged) this.view.openDiff({ kind: "staged", file: inStaged });
          else this.view.closeDiff();
        } else if (source.kind === "staged" && !inStaged) {
          if (inUnstaged) this.view.openDiff({ kind: "unstaged", file: inUnstaged });
          else this.view.closeDiff();
        }
      });
    });
  }

  hunkActions(source: GitDiffSource): GitHunkActions {
    if (source.kind === "commit" || source.file.status === "U") return "none";
    return source.kind;
  }

  emptyText(source: GitDiffSource): string {
    if (source.file.status === "?") return "Untracked file - stage it as a whole";
    return "No text changes (mode or rename only)";
  }

  origin(source: GitDiffSource): string {
    if (source.kind === "commit") return source.sha.slice(0, 7);
    return source.kind === "staged" ? "Staged" : "Unstaged";
  }

  statusIcon(source: GitDiffSource) {
    return fileStatusIcon(source.file);
  }

  statusClass(source: GitDiffSource): string {
    return fileStatusClass(source.file);
  }

  private async loadPatch(source: GitDiffSource, key: string): Promise<void> {
    const keepShowing = this.patch() !== null && key === this.loadedKey;
    if (!keepShowing) this.patch.set(null);
    const patch = await this.diffs.loadPatch(source);
    // Another file was opened while git was reading this one.
    if (key !== this.sourceKey() || this.view.diffMode() !== "hunks") return;
    this.loadedKey = key;
    this.patch.set(patch);
  }

  private async load(source: GitDiffSource, key: string): Promise<void> {
    const keepShowing = this.content() !== null && key === this.loadedKey;
    if (!keepShowing) this.content.set(null);
    const content = await this.diffs.loadDiff(source);
    // Another file was opened while git was reading this one.
    if (key !== this.sourceKey() || this.view.diffMode() === "hunks") return;
    this.loadedKey = key;
    const current = this.content();
    if (current && current.original === content.original && current.modified === content.modified)
      return;
    this.content.set(content);
  }
}
