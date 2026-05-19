import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  signal,
} from "@angular/core";
import { Opener } from "@cogno/core-api";
import { Icon, IconComponent, ToggleButtonComponent, TooltipDirective } from "@cogno/core-ui";
import { GitDiffContent, GitDiffService } from "./git-diff.service";
import { GitDiffViewComponent } from "./git-diff-view.component";
import { GitGraphComponent } from "./git-graph.component";
import { CommitFile, GitGraphService } from "./git-graph.service";
import { GitFile, GitStatusService } from "./git-status.service";

type SelectedFile = {
  file: GitFile;
  isStaged: boolean;
  commitHash?: string;
  originalPath?: string;
};

@Component({
  selector: "app-git-side",
  standalone: true,
  imports: [
    IconComponent,
    ToggleButtonComponent,
    TooltipDirective,
    GitDiffViewComponent,
    GitGraphComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="git-panel">
      <!-- Header -->
      <header class="git-header">
        <span class="branch">
          @if (status()) {
            <app-toggle-button
              [active]="showGraph()"
              title="Toggle graph"
              (click)="toggleGraph()"
              class="graph-toggle"
            >
              <app-icon name="mdiSourceBranch"></app-icon>
            </app-toggle-button>
          }
          <app-icon name="mdiGit"></app-icon>
          @if (status()) {
            <span>{{ status()!.branch }}</span>
          }
        </span>
        <button
          type="button"
          class="button icon-button"
          appTooltip="Refresh"
          [disabled]="loading()"
          (click)="refresh()"
        >
          <app-icon name="mdiRefresh"></app-icon>
        </button>
      </header>

      <div class="git-panel-body">
      @if (status()) {
        @if (showGraph()) {
          <div class="git-graph-pane" [style.width]="graphPaneWidthPx() != null ? graphPaneWidthPx() + 'px' : '50%'">
            <div class="graph-resize-handle" (pointerdown)="startGraphResize($event)"></div>
            <app-git-graph
              [commits]="graphCommits()"
              [hasUncommittedChanges]="hasUncommittedChanges()"
              [selectedHash]="selectedCommitHash() ?? 'WIP'"
              [loading]="graphLoading()"
              (commitClick)="selectCommit($event)"
              (loadMore)="loadMoreGraph()"
            />
          </div>
        }
        <div class="git-main-content" [class.with-diff]="selectedFile() && (diff() || diffLoading())"
          [class.graph-visible]="showGraph()">
          <section class="commit-area">
            <textarea
              class="commit-message"
              placeholder="Commit message..."
              [value]="commitMessage()"
              (input)="onCommitInput($event)"
            ></textarea>
            <button
              type="button"
              class="button"
              [disabled]="!canCommit()"
              (click)="commit()"
            >
              Commit
            </button>
          </section>

          <div class="file-sections-scroll-area">
            @if (selectedCommitHash()) {
              <section class="file-section">
                <div class="section-header">
                  <span class="section-toggle commit-section-label">
                    <app-icon name="mdiSourceBranch"></app-icon>
                    <div class="commit-label-body">
                      <div class="commit-label-main">
                        <span class="commit-hash-label">{{ selectedCommitHash()!.slice(0, 7) }}</span>
                        @if (selectedCommitNode()) {
                          <span class="commit-subject-label">{{ selectedCommitNode()!.subject }}</span>
                        }
                      </div>
                      @if (selectedCommitNode()?.author) {
                        <span class="commit-author-line">{{ selectedCommitNode()!.author }} · {{ selectedCommitNode()!.date }}</span>
                      }
                    </div>
                  </span>
                </div>
                @if (commitFilesLoading()) {
                  <div class="diff-loading-state commit-files-loading">
                    <app-icon name="mdiLoading"></app-icon>
                    <span>Loading...</span>
                  </div>
                } @else if (commitFiles().length === 0) {
                  <div class="empty-state">No files changed</div>
                } @else {
                  <ul class="file-list">
                    @for (file of commitFiles(); track file.path) {
                      <li
                        class="file-item"
                        [class.selected]="isCommitFileSelected(file)"
                        (click)="selectCommitFile(file)"
                      >
                        <span
                          class="status-badge"
                          [class.status-edited]="file.status === 'M' || file.status === 'R'"
                          [class.status-added]="file.status === 'A'"
                          [class.status-removed]="file.status === 'D'"
                        >
                          <app-icon [name]="commitFileStatusIcon(file)"></app-icon>
                        </span>
                        <div class="file-name-group">
                          <span class="file-path" [title]="file.path">{{ fileName(file.path) }}</span>
                        </div>
                        <span class="file-dir">{{ fileDir(file.path) }}</span>
                      </li>
                    }
                  </ul>
                }
              </section>
            } @else {
              @if (status()!.staged.length > 0) {
                <section class="file-section">
                  <div class="section-header">
                    <button type="button" class="section-toggle" (click)="toggleStaged()">
                      <app-icon [name]="stagedExpanded() ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                      <span>STAGED ({{ status()!.staged.length }})</span>
                    </button>
                    <button
                      type="button"
                      class="button icon-button file-action-button"
                      appTooltip="Unstage all"
                      (click)="unstageAll()"
                    >
                      <app-icon name="mdiMinus"></app-icon>
                    </button>
                  </div>
                  @if (stagedExpanded()) {
                    <ul class="file-list">
                      @for (file of status()!.staged; track file.path) {
                        <li
                          class="file-item staged"
                          [class.selected]="isSelected(file, true)"
                          (click)="selectFile(file, true)"
                        >
                          <span
                            class="status-badge"
                            [class.status-edited]="isEditedStatus(file)"
                            [class.status-added]="isAddedStatus(file)"
                            [class.status-removed]="isRemovedStatus(file)"
                          >
                            <app-icon [name]="fileStatusIcon(file)"></app-icon>
                          </span>
                          <div class="file-name-group">
                            <span class="file-path" [title]="file.path">{{ fileName(file.path) }}</span>
                            @if (file.status !== 'D') {
                              <button
                                type="button"
                                class="button icon-button file-action-button open-in-editor-btn"
                                appTooltip="Open in editor"
                                (click)="$event.stopPropagation(); openInEditor(file)"
                              >
                                <app-icon name="mdiOpenInNew"></app-icon>
                              </button>
                            }
                          </div>
                          <span class="file-dir">{{ fileDir(file.path) }}</span>
                          <button
                            type="button"
                            class="button icon-button file-action-button"
                            appTooltip="Unstage"
                            (click)="$event.stopPropagation(); unstageFile(file.path)"
                          >
                            <app-icon name="mdiMinus"></app-icon>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </section>
              }

              @if (changeFiles().length > 0) {
                <section class="file-section">
                  <div class="section-header">
                    <button type="button" class="section-toggle" (click)="toggleUnstaged()">
                      <app-icon [name]="unstagedExpanded() ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                      <span class="changes-summary">
                        <span>CHANGES</span>
                        <span class="changes-counts">
                          (
                          <span class="changes-count-item">
                            <app-icon name="mdiSquareEditOutline"></app-icon>
                            <span>{{ modifiedUnstagedCount() }}</span>
                          </span>
                          <span class="changes-count-item">
                            <app-icon name="mdiPlus"></app-icon>
                            <span>{{ addedUnstagedCount() }}</span>
                          </span>
                          )
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="button icon-button file-action-button"
                      appTooltip="Stage all"
                      (click)="stageAll()"
                    >
                      <app-icon name="mdiPlus"></app-icon>
                    </button>
                  </div>
                  @if (unstagedExpanded()) {
                    <ul class="file-list">
                      @for (file of changeFiles(); track file.path) {
                        <li
                          class="file-item unstaged"
                          [class.selected]="isSelected(file, false)"
                          (click)="selectFile(file, false)"
                        >
                          <span
                            class="status-badge"
                            [class.status-edited]="isEditedStatus(file)"
                            [class.status-added]="isAddedStatus(file)"
                            [class.status-removed]="isRemovedStatus(file)"
                          >
                            <app-icon [name]="fileStatusIcon(file)"></app-icon>
                          </span>
                          <div class="file-name-group">
                            <span class="file-path" [title]="file.path">{{ fileName(file.path) }}</span>
                            <button
                              type="button"
                              class="button icon-button file-action-button open-in-editor-btn"
                              appTooltip="Open in editor"
                              (click)="$event.stopPropagation(); openInEditor(file)"
                            >
                              <app-icon name="mdiOpenInNew"></app-icon>
                            </button>
                          </div>
                          <span class="file-dir">{{ fileDir(file.path) }}</span>
                          @if (file.status !== '?') {
                            @if (isDiscardConfirmationPending(file.path)) {
                              <div
                                class="file-action-group"
                                (mouseleave)="cancelDiscardConfirmation()"
                              >
                                <button
                                  type="button"
                                  class="button icon-button file-action-button"
                                  appTooltip="Confirm discard changes"
                                  (click)="$event.stopPropagation(); confirmDiscardFile(file.path)"
                                >
                                  <app-icon name="mdiCheck"></app-icon>
                                </button>
                                <button
                                  type="button"
                                  class="button icon-button file-action-button"
                                  appTooltip="Cancel discard changes"
                                  (click)="$event.stopPropagation(); cancelDiscardConfirmation()"
                                >
                                  <app-icon name="mdiClose"></app-icon>
                                </button>
                              </div>
                            } @else {
                              <button
                                type="button"
                                class="button icon-button file-action-button discard-button"
                                appTooltip="Discard changes"
                                (click)="$event.stopPropagation(); requestDiscardConfirmation(file.path)"
                              >
                                <app-icon name="mdiTrashCanOutline"></app-icon>
                              </button>
                            }
                          }
                          <button
                            type="button"
                            class="button icon-button file-action-button"
                            appTooltip="Stage"
                            (click)="$event.stopPropagation(); stageFile(file.path)"
                          >
                            <app-icon name="mdiPlus"></app-icon>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </section>
              }

              @if (status()!.staged.length === 0 && changeFiles().length === 0) {
                <div class="empty-state">No changes</div>
              }
            }
          </div>

          @if (selectedFile() && (diff() || diffLoading())) {
            <section class="diff-section">
              <div class="diff-header">
                <span class="diff-file-name">{{ selectedFile()!.file.path }}</span>
                <button type="button" class="button icon-button" appTooltip="Close diff" (click)="closeDiff()">
                  <app-icon name="mdiClose"></app-icon>
                </button>
              </div>
              <div class="diff-view-wrapper">
                @if (diffLoading()) {
                  <div class="diff-loading-state">
                    <app-icon name="mdiLoading"></app-icon>
                    <span>Loading diff...</span>
                  </div>
                } @else if (diff()) {
                  @defer (when diff() !== null) {
                    <app-git-diff-view [diff]="diff()"></app-git-diff-view>
                  }
                }
              </div>
            </section>
          }
        </div>
      } @else if (gitError() === 'not_installed') {
        <div class="git-unavailable">
          <app-icon name="mdiAlert"></app-icon>
          <span>Git is not installed or not in PATH</span>
        </div>
      } @else if (gitError() === 'no_repo') {
        <div class="git-unavailable">
          <app-icon name="mdiGit"></app-icon>
          <span>Not a git repository</span>
        </div>
      } @else {
        <div class="git-unavailable">
          <app-icon name="mdiGit"></app-icon>
          <span>No terminal focused</span>
        </div>
      }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --git-primary-font-size: 1em;
        --git-secondary-font-size: 0.875em;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        font-size: inherit;
      }

      .git-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .git-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.4rem 0;
        gap: 0.5rem;
      }



      .branch {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-weight: 500;
        color: var(--foreground-color);
        min-width: 0;
      }

      .graph-toggle app-icon {
        width: 1rem;
        height: 1rem;
      }

      .git-unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        flex: 1;
        color: var(--foreground-color-10t);
        font-style: italic;
        text-align: center;
        padding: 1rem;
      }

      .git-unavailable app-icon {
        width: 1.5rem;
        height: 1.5rem;
        opacity: 0.4;
      }

      .commit-area {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.4rem;
        padding: 0 0.5rem;
      }

      .commit-area .commit-message {
        align-self: stretch;
      }

      .commit-message {
        width: 100%;
        min-height: 56px;
        max-height: 120px;
        resize: vertical;
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid var(--background-color-20l);
        border-radius: var(--button-border-radius);
        padding: 0.4rem 0.5rem;
        font-family: inherit;
        font-size: inherit;
        box-sizing: border-box;
      }

      .commit-message:focus {
        outline: none;
        border-color: var(--highlight-color);
      }
      
      .file-section {
        flex: 0 0 auto;
      }

      .git-panel-body {
        flex: 1;
        display: flex;
        flex-direction: row;
        min-height: 0;
        overflow: hidden;
      }

      .git-graph-pane {
        flex: 0 0 auto;
        border-right: 1px solid var(--background-color-20l);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
      }

      .graph-resize-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        right: -4px;
        width: 8px;
        cursor: ew-resize;
        z-index: 3;
      }

      .git-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        gap: 0.75rem;
        min-width: 200px;
      }

      .file-sections-scroll-area {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }

      .git-main-content.with-diff .file-sections-scroll-area {
        flex: 0 0 auto;
        max-height: 50%;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.2rem 0.5rem 0.2rem 0.25rem;
        background: var(--background-color);
      }

      .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        background: none;
        border: none;
        color: var(--foreground-color-10t);
        font-size: var(--git-secondary-font-size);
        font-weight: 600;
        letter-spacing: 0.05em;
        padding: 0;
        min-width: 0;
        overflow: hidden;
      }

      .commit-section-label {
        gap: 0.35rem;
        overflow: hidden;
      }

      .commit-section-label app-icon {
        width: 0.9rem;
        height: 0.9rem;
        flex: 0 0 auto;
      }

      .commit-hash-label {
        flex: 0 0 auto;
        font-family: var(--font-mono, monospace);
        color: var(--highlight-color);
      }

      .commit-subject-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 400;
        letter-spacing: normal;
        color: var(--foreground-color-10t);
      }

      .commit-label-body {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
        overflow: hidden;
      }

      .commit-label-main {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 0;
        overflow: hidden;
      }

      .commit-author-line {
        font-size: 0.75em;
        font-weight: 400;
        letter-spacing: normal;
        color: var(--foreground-color-10t);
        opacity: 0.7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .commit-files-loading {
        height: 48px;
        flex-direction: row;
        font-size: var(--git-secondary-font-size);
      }

      .commit-files-loading app-icon {
        width: 0.9rem;
        height: 0.9rem;
        animation: git-diff-spin 1s linear infinite;
      }

      .changes-summary {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }

      .changes-counts {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
      }

      .changes-count-item {
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
      }

      .changes-count-item app-icon {
        width: 0.8rem;
        height: 0.8rem;
      }

      .section-toggle:hover {
        color: var(--foreground-color);
      }

      .file-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.2rem 0.5rem 0.2rem 0.75rem;
        cursor: pointer;
      }

      .file-item:hover {
        background: var(--background-color-10l);
      }

      .file-item.selected {
        background: var(--highlight-color-ct2);
      }

      .status-badge {
        flex: 0 0 auto;
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .status-badge app-icon {
        width: 14px;
        height: 14px;
      }

      .status-edited { color: var(--color-yellow); }
      .status-added { color: var(--color-green); }
      .status-removed { color: var(--color-red); }

      .file-name-group {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
        overflow: hidden;
      }

      .file-path {
        flex: 0 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--foreground-color);
        font-size: var(--git-primary-font-size);
      }

      .file-dir {
        flex: 0 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--foreground-color-10t);
        font-size: var(--git-primary-font-size);
        max-width: 40%;
      }

      .file-action-button {
        flex: 0 0 auto;
        width: 1.75rem;
        height: 1.75rem;
        padding: 0.25rem;
        color: var(--foreground-color-10t);
      }

      .file-action-group {
        display: inline-flex;
        align-items: center;
        gap: 0.1rem;
      }

      .file-action-button app-icon {
        width: 1.15rem;
        height: 1.15rem;
      }

      .file-action-button:hover {
        color: var(--foreground-color);
      }

      .open-in-editor-btn {
        opacity: 0.4;
      }

      .file-name-group:hover .open-in-editor-btn {
        opacity: 1;
      }

      .icon-button app-icon {
        width: 1rem;
        height: 1rem;
      }

      .icon-button:disabled {
        opacity: 0.2;
        cursor: not-allowed;
      }

      .empty-state {
        padding: 1rem 0.75rem;
        color: var(--foreground-color-10t);
        font-style: italic;
        text-align: center;
      }

      .diff-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .diff-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.3rem 0.5rem;
        background: var(--background-color);
      }

      .diff-file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--foreground-color-10t);
        font-size: var(--git-primary-font-size);
      }

      .diff-view-wrapper {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
      }

      .diff-loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        height: 100%;
        color: var(--foreground-color-10t);
      }

      .diff-loading-state app-icon {
        width: 1.2rem;
        height: 1.2rem;
        animation: git-diff-spin 1s linear infinite;
      }

      @keyframes git-diff-spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class GitSideComponent {
  readonly status = this.gitStatusService.status;
  readonly gitError = this.gitStatusService.gitError;
  readonly loading = this.gitStatusService.loading;
  readonly stagedCount = this.gitStatusService.stagedCount;

  readonly showGraph = signal(true);
  readonly graphLoading = this.gitGraphService.loading;
  readonly graphPaneWidthPx = signal<number | null>(null);
  readonly hasUncommittedChanges = computed(() => {
    const s = this.status();
    if (!s) return false;
    return s.staged.length > 0 || s.unstaged.length > 0 || s.untracked.length > 0;
  });
  get graphCommits() {
    return this.gitGraphService.commits;
  }
  private lastGraphRoot: string | null = null;
  private graphResizeStartX = 0;
  private graphResizeStartWidth = 0;
  private graphResizeContainerWidth = 0;

  private readonly commitMessageSignal = signal("");
  readonly commitMessage = this.commitMessageSignal.asReadonly();

  readonly canCommit = computed(
    () => this.stagedCount() > 0 && this.commitMessageSignal().trim().length > 0,
  );

  readonly stagedExpanded = signal(true);
  readonly unstagedExpanded = signal(true);
  readonly changeFiles = computed(() => [
    ...(this.status()?.unstaged ?? []),
    ...(this.status()?.untracked ?? []),
  ]);
  readonly modifiedUnstagedCount = computed(
    () => this.status()?.unstaged.filter((file) => file.status !== "A").length ?? 0,
  );
  readonly addedUnstagedCount = computed(
    () =>
      (this.status()?.unstaged.filter((file) => file.status === "A").length ?? 0) +
      (this.status()?.untracked.length ?? 0),
  );

  private readonly selectedCommitHashSignal = signal<string | null>(null);
  readonly selectedCommitHash = this.selectedCommitHashSignal.asReadonly();
  private readonly commitFilesSignal = signal<CommitFile[]>([]);
  readonly commitFiles = this.commitFilesSignal.asReadonly();
  private readonly commitFilesLoadingSignal = signal(false);
  readonly commitFilesLoading = this.commitFilesLoadingSignal.asReadonly();
  readonly selectedCommitNode = computed(() => {
    const hash = this.selectedCommitHashSignal();
    if (!hash) return null;
    return this.gitGraphService.commits()?.find((c) => c.hash === hash) ?? null;
  });

  private readonly selectedFileSignal = signal<SelectedFile | null>(null);
  readonly selectedFile = this.selectedFileSignal.asReadonly();
  private readonly discardConfirmationFilePathSignal = signal<string | null>(null);

  private readonly diffLoadingSignal = signal(false);
  readonly diffLoading = this.diffLoadingSignal.asReadonly();
  private readonly diffSignal = signal<GitDiffContent | null>(null);
  readonly diff = this.diffSignal.asReadonly();

  constructor(
    private readonly gitStatusService: GitStatusService,
    private readonly gitDiffService: GitDiffService,
    private readonly gitGraphService: GitGraphService,
    private readonly opener: Opener,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => {
      window.removeEventListener("pointermove", this.onGraphResizeMove, true);
      window.removeEventListener("pointerup", this.onGraphResizeUp, true);
    });
    effect(() => {
      const status = this.status();
      const sel = this.selectedFileSignal();
      if (!sel || !status || sel.commitHash) return;
      const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];
      const stillExists = allFiles.some((f) => f.path === sel.file.path);
      if (!stillExists) this.closeDiff();
    });

    effect(() => {
      const show = this.showGraph();
      const status = this.status();
      if (show && status) {
        if (status.gitRoot !== this.lastGraphRoot) {
          this.lastGraphRoot = status.gitRoot;
          void this.gitGraphService.load(status.gitRoot, status.shellContext);
        }
      } else if (!show) {
        this.lastGraphRoot = null;
        this.gitGraphService.clear();
      }
    });
  }

  refresh(): void {
    void this.gitStatusService.refreshStatus();
  }

  loadMoreGraph(): void {
    void this.gitGraphService.loadMore();
  }

  toggleGraph(): void {
    this.showGraph.update((v) => !v);
  }

  startGraphResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const pane = (e.currentTarget as HTMLElement).parentElement!;
    this.graphResizeStartX = e.clientX;
    this.graphResizeStartWidth = pane.offsetWidth;
    this.graphResizeContainerWidth = pane.parentElement!.offsetWidth;
    window.addEventListener("pointermove", this.onGraphResizeMove, true);
    window.addEventListener("pointerup", this.onGraphResizeUp, true);
  }

  private readonly onGraphResizeMove = (e: PointerEvent): void => {
    const delta = e.clientX - this.graphResizeStartX;
    const max = this.graphResizeContainerWidth - 200;
    this.graphPaneWidthPx.set(Math.max(180, Math.min(max, this.graphResizeStartWidth + delta)));
  };

  private readonly onGraphResizeUp = (): void => {
    window.removeEventListener("pointermove", this.onGraphResizeMove, true);
    window.removeEventListener("pointerup", this.onGraphResizeUp, true);
  };

  onCommitInput(event: Event): void {
    this.commitMessageSignal.set((event.target as HTMLTextAreaElement).value);
  }

  commit(): void {
    const message = this.commitMessageSignal().trim();
    if (!message) return;
    void this.gitStatusService.commit(message).then(() => {
      this.commitMessageSignal.set("");
      this.selectedFileSignal.set(null);
      this.diffSignal.set(null);
    });
  }

  requestDiscardConfirmation(path: string): void {
    this.discardConfirmationFilePathSignal.set(path);
  }

  cancelDiscardConfirmation(): void {
    this.discardConfirmationFilePathSignal.set(null);
  }

  isDiscardConfirmationPending(path: string): boolean {
    return this.discardConfirmationFilePathSignal() === path;
  }

  confirmDiscardFile(path: string): void {
    this.discardConfirmationFilePathSignal.set(null);
    void this.gitStatusService.discardFileChanges(path);
  }

  openInEditor(file: GitFile): void {
    const status = this.status();
    if (!status) return;
    void this.opener.openPath(`${status.gitRoot}/${file.path}`);
  }

  stageFile(path: string): void {
    void this.gitStatusService.stageFile(path);
  }

  unstageFile(path: string): void {
    void this.gitStatusService.unstageFile(path);
  }

  stageAll(): void {
    void this.gitStatusService.stageAll();
  }

  unstageAll(): void {
    void this.gitStatusService.unstageAll();
  }

  toggleStaged(): void {
    this.stagedExpanded.update((v) => !v);
  }
  toggleUnstaged(): void {
    this.unstagedExpanded.update((v) => !v);
  }

  isSelected(file: GitFile, isStaged: boolean): boolean {
    const sel = this.selectedFileSignal();
    return !sel?.commitHash && sel?.file.path === file.path && sel?.isStaged === isStaged;
  }

  fileStatusIcon(file: GitFile): Icon {
    if (file.status === "A" || file.status === "?") return "mdiPlus";
    if (file.status === "D") return "mdiMinus";
    return "mdiPencil";
  }

  isEditedStatus(file: GitFile): boolean {
    return !this.isAddedStatus(file) && !this.isRemovedStatus(file);
  }

  isAddedStatus(file: GitFile): boolean {
    return file.status === "A" || file.status === "?";
  }

  isRemovedStatus(file: GitFile): boolean {
    return file.status === "D";
  }

  selectFile(file: GitFile, isStaged: boolean): void {
    if (this.isSelected(file, isStaged)) {
      this.selectedFileSignal.set(null);
      this.diffLoadingSignal.set(false);
      this.diffSignal.set(null);
      return;
    }

    this.selectedFileSignal.set({ file, isStaged });
    this.diffLoadingSignal.set(true);
    this.diffSignal.set(null);
    void this.loadDiff(file, isStaged);
  }

  closeDiff(): void {
    this.selectedFileSignal.set(null);
    this.diffLoadingSignal.set(false);
    this.diffSignal.set(null);
  }

  selectCommit(hash: string | null): void {
    const current = this.selectedCommitHashSignal();
    const next = hash && hash !== current ? hash : null;
    this.selectedCommitHashSignal.set(next);
    this.commitFilesSignal.set([]);
    this.closeDiff();
    if (next) {
      this.commitFilesLoadingSignal.set(true);
      void this.loadCommitFilesData(next);
    }
  }

  private async loadCommitFilesData(hash: string): Promise<void> {
    const status = this.status();
    if (!status) {
      this.commitFilesLoadingSignal.set(false);
      return;
    }
    try {
      const files = await this.gitGraphService.loadCommitFiles(
        hash,
        status.gitRoot,
        status.shellContext,
      );
      if (this.selectedCommitHashSignal() !== hash) return;
      this.commitFilesSignal.set(files);
    } finally {
      if (this.selectedCommitHashSignal() === hash) {
        this.commitFilesLoadingSignal.set(false);
      }
    }
  }

  isCommitFileSelected(file: CommitFile): boolean {
    const sel = this.selectedFileSignal();
    return (
      !!sel?.commitHash &&
      sel.commitHash === this.selectedCommitHashSignal() &&
      sel.file.path === file.path
    );
  }

  commitFileStatusIcon(file: CommitFile): Icon {
    if (file.status === "A") return "mdiPlus";
    if (file.status === "D") return "mdiMinus";
    return "mdiPencil";
  }

  selectCommitFile(file: CommitFile): void {
    if (this.isCommitFileSelected(file)) {
      this.closeDiff();
      return;
    }
    const hash = this.selectedCommitHashSignal();
    if (!hash) {
      return;
    }
    const gitFile: GitFile = { path: file.path, status: file.status === "R" ? "M" : file.status };
    this.selectedFileSignal.set({
      file: gitFile,
      isStaged: false,
      commitHash: hash,
      originalPath: file.originalPath,
    });
    this.diffLoadingSignal.set(true);
    this.diffSignal.set(null);
    void this.loadDiff(gitFile, false, hash, file.originalPath);
  }

  fileName(path: string): string {
    return path.split("/").pop() ?? path;
  }

  fileDir(path: string): string {
    const parts = path.split("/");
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/");
  }

  private async loadDiff(
    file: GitFile,
    isStaged: boolean,
    commitHash?: string,
    originalPath?: string,
  ): Promise<void> {
    const status = this.status();
    if (!status) {
      this.diffLoadingSignal.set(false);
      return;
    }

    const snapshot = status.shellContext;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const checkSelected = (): boolean => {
      const sel = this.selectedFileSignal();
      if (!sel || sel.file.path !== file.path) return false;
      return commitHash
        ? sel.commitHash === commitHash
        : !sel.commitHash && sel.isStaged === isStaged;
    };

    try {
      let diff: GitDiffContent;
      if (commitHash) {
        diff = await this.gitDiffService.loadCommitFileDiff(
          commitHash,
          file.path,
          originalPath ?? file.path,
          file.status === "D",
          status.gitRoot,
        );
      } else {
        diff = await this.gitDiffService.loadDiff(
          file.path,
          isStaged,
          file.status === "D",
          status.gitRoot,
          snapshot,
        );
      }
      if (!checkSelected()) return;
      this.diffSignal.set(diff);
    } finally {
      if (checkSelected()) {
        this.diffLoadingSignal.set(false);
      }
    }
  }
}
