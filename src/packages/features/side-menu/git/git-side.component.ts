import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from "@angular/core";
import { IconComponent } from "@cogno/core-ui";
import { GitDiffContent, GitDiffService } from "./git-diff.service";
import { GitDiffViewComponent } from "./git-diff-view.component";
import { GitFile, GitStatusService } from "./git-status.service";

type SelectedFile = {
  file: GitFile;
  isStaged: boolean;
};

@Component({
  selector: "app-git-side",
  standalone: true,
  imports: [IconComponent, GitDiffViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="git-panel">
      <!-- Header -->
      <header class="git-header">
        @if (status()) {
          <span class="branch">
            <app-icon name="mdiGit"></app-icon>
            {{ status()!.branch }}
          </span>
        } @else {
          <span class="branch">
            <app-icon name="mdiGit"></app-icon>
            Git
          </span>
        }
        <button
          type="button"
          class="icon-button"
          title="Refresh"
          [disabled]="loading()"
          (click)="refresh()"
        >
          <app-icon name="mdiRefresh"></app-icon>
        </button>
      </header>

      @if (status()) {
        <div class="git-main-content" [class.with-diff]="selectedFile() && (diff() || diffLoading())">
          <section class="commit-area">
            <textarea
              class="commit-message"
              placeholder="Commit message..."
              [value]="commitMessage()"
              (input)="onCommitInput($event)"
            ></textarea>
            <button
              type="button"
              class="commit-button"
              [disabled]="!canCommit()"
              (click)="commit()"
            >
              Commit ({{ stagedCount() }})
            </button>
          </section>

          <div class="file-sections-scroll-area">
            @if (status()!.staged.length > 0) {
              <section class="file-section">
                <div class="section-header">
                  <button type="button" class="section-toggle" (click)="toggleStaged()">
                    <app-icon [name]="stagedExpanded() ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                    <span>STAGED ({{ status()!.staged.length }})</span>
                  </button>
                  <button type="button" class="action-btn" title="Unstage all" (click)="unstageAll()">−all</button>
                </div>
                @if (stagedExpanded()) {
                  <ul class="file-list">
                    @for (file of status()!.staged; track file.path) {
                      <li
                        class="file-item staged"
                        [class.selected]="isSelected(file, true)"
                        (click)="selectFile(file, true, $event)"
                      >
                        <span class="status-badge staged">{{ file.status }}</span>
                        <span class="file-path" [title]="file.path">{{ fileName(file.path) }}</span>
                        <span class="file-dir">{{ fileDir(file.path) }}</span>
                        <button
                          type="button"
                          class="action-btn"
                          title="Unstage"
                          (click)="$event.stopPropagation(); unstageFile(file.path)"
                        >−</button>
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
                  <button type="button" class="action-btn" title="Stage all" (click)="stageAll()">+all</button>
                </div>
                @if (unstagedExpanded()) {
                  <ul class="file-list">
                    @for (file of changeFiles(); track file.path) {
                      <li
                        class="file-item unstaged"
                        [class.selected]="isSelected(file, false)"
                        (click)="selectFile(file, false, $event)"
                      >
                        <span
                          class="status-badge"
                          [class.unstaged]="file.status !== '?'"
                          [class.untracked]="file.status === '?'"
                        >
                          {{ file.status }}
                        </span>
                        <span class="file-path" [title]="file.path">{{ fileName(file.path) }}</span>
                        <span class="file-dir">{{ fileDir(file.path) }}</span>
                        <button
                          type="button"
                          class="action-btn"
                          title="Stage"
                          (click)="$event.stopPropagation(); stageFile(file.path)"
                        >+</button>
                      </li>
                    }
                  </ul>
                }
              </section>
            }

            @if (status()!.staged.length === 0 && changeFiles().length === 0) {
              <div class="empty-state">No changes</div>
            }
          </div>

          @if (selectedFile() && (diff() || diffLoading())) {
            <section class="diff-section">
              <div class="diff-header">
                <span class="diff-file-name">{{ selectedFile()!.file.path }}</span>
                <button type="button" class="icon-button" (click)="closeDiff()">
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
                  <app-git-diff-view [diff]="diff()" [isDark]="true"></app-git-diff-view>
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
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        font-size: 0.85rem;
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
        padding: 0.4rem 0.75rem;
        border-bottom: 1px solid var(--color-border, #333);
        gap: 0.5rem;
      }

      .branch {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-weight: 500;
        color: var(--color-text-primary, #ccc);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .no-repo {
        color: var(--color-text-muted, #666);
        font-style: italic;
      }

      .git-unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        flex: 1;
        color: var(--color-text-muted, #666);
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
        gap: 0.4rem;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--color-border, #333);
      }

      .commit-message {
        width: 100%;
        min-height: 56px;
        max-height: 120px;
        resize: vertical;
        background: var(--color-input-bg, #1e1e1e);
        color: var(--color-text-primary, #ccc);
        border: 1px solid var(--color-border, #444);
        border-radius: 4px;
        padding: 0.4rem 0.5rem;
        font-family: inherit;
        font-size: inherit;
        box-sizing: border-box;
      }

      .commit-message:focus {
        outline: none;
        border-color: var(--color-accent, #4a9eff);
      }

      .commit-button {
        align-self: flex-end;
        padding: 0.3rem 0.75rem;
        background: var(--color-accent, #4a9eff);
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: inherit;
        font-weight: 500;
      }

      .commit-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .file-section {
        flex: 0 0 auto;
      }

      .git-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .file-sections-scroll-area {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        border-bottom: 1px solid var(--color-border, #333);
      }

      .git-main-content.with-diff .file-sections-scroll-area {
        flex: 0 1 45%;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.2rem 0.5rem 0.2rem 0.25rem;
        background: var(--color-surface-2, #1a1a1a);
        border-bottom: 1px solid var(--color-border, #2a2a2a);
      }

      .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        background: none;
        border: none;
        color: var(--color-text-muted, #888);
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        padding: 0;
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
        color: var(--color-text-primary, #ccc);
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
        border-bottom: 1px solid var(--color-border, #2a2a2a);
      }

      .file-item:hover {
        background: var(--color-hover, #252525);
      }

      .file-item.selected {
        background: var(--color-selected, #1e3a5f);
      }

      .status-badge {
        flex: 0 0 auto;
        width: 14px;
        font-weight: 700;
        font-size: 0.8rem;
        text-align: center;
      }

      .status-badge.staged { color: #4ec94e; }
      .status-badge.unstaged { color: #e06c75; }
      .status-badge.untracked { color: #888; }

      .file-path {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-primary, #ccc);
      }

      .file-dir {
        flex: 0 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-muted, #666);
        font-size: 0.75rem;
        max-width: 40%;
      }

      .action-btn {
        flex: 0 0 auto;
        background: none;
        border: 1px solid var(--color-border, #444);
        color: var(--color-text-muted, #888);
        border-radius: 3px;
        padding: 0 0.3rem;
        cursor: pointer;
        font-size: 0.8rem;
        line-height: 1.4;
      }

      .action-btn:hover {
        color: var(--color-text-primary, #ccc);
        border-color: var(--color-text-muted, #888);
      }

      .icon-button {
        background: none;
        border: none;
        color: var(--color-text-muted, #888);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 0.2rem;
        border-radius: 3px;
      }

      .icon-button:hover {
        color: var(--color-text-primary, #ccc);
        background: var(--color-hover, #252525);
      }

      .icon-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .empty-state {
        padding: 1rem 0.75rem;
        color: var(--color-text-muted, #666);
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
        background: var(--color-surface-2, #1a1a1a);
        border-bottom: 1px solid var(--color-border, #333);
      }

      .diff-file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-muted, #888);
        font-size: 0.8rem;
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
        color: var(--color-text-muted, #888);
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

  readonly commitMessageSignal = signal("");
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

  readonly selectedFileSignal = signal<SelectedFile | null>(null);
  readonly selectedFile = this.selectedFileSignal.asReadonly();

  readonly diffLoadingSignal = signal(false);
  readonly diffLoading = this.diffLoadingSignal.asReadonly();
  readonly diffSignal = signal<GitDiffContent | null>(null);
  readonly diff = this.diffSignal.asReadonly();

  constructor(
    private readonly gitStatusService: GitStatusService,
    private readonly gitDiffService: GitDiffService,
    _destroyRef: DestroyRef,
  ) {}

  refresh(): void {
    void this.gitStatusService.refreshStatus();
  }

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
    return sel?.file.path === file.path && sel?.isStaged === isStaged;
  }

  selectFile(file: GitFile, isStaged: boolean, _event: MouseEvent): void {
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

  fileName(path: string): string {
    return path.split("/").pop() ?? path;
  }

  fileDir(path: string): string {
    const parts = path.split("/");
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/");
  }

  private async loadDiff(file: GitFile, isStaged: boolean): Promise<void> {
    const status = this.status();
    if (!status) {
      this.diffLoadingSignal.set(false);
      return;
    }

    const snapshot = this.getSnapshotContext();
    if (!snapshot) {
      this.diffLoadingSignal.set(false);
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const diff = await this.gitDiffService.loadDiff(
      file.path,
      isStaged,
      file.status === "D",
      status.gitRoot,
      snapshot,
    );
    if (!this.isSelected(file, isStaged)) return;
    this.diffLoadingSignal.set(false);
    this.diffSignal.set(diff);
  }

  private getSnapshotContext() {
    return this.gitStatusService.currentShellContext;
  }
}
