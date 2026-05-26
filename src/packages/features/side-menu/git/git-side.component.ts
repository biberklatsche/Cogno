import { ChangeDetectionStrategy, Component, computed, effect, signal, untracked } from "@angular/core";
import { Opener } from "@cogno/core-api";
import { Icon, IconComponent, TooltipDirective } from "@cogno/core-ui";
import { GitDiffContent, GitDiffService } from "./git-diff.service";
import { GitDiffViewComponent } from "./git-diff-view.component";
import { GitFile, GitStatusService } from "./git-status.service";

type SelectedFile = {
  file: GitFile;
  isStaged: boolean;
};

type ChangeItem = { kind: 'file' | 'dir' | 'dir-child'; file: GitFile };

@Component({
  selector: "app-git-side",
  standalone: true,
  imports: [IconComponent, TooltipDirective, GitDiffViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="git-panel">
      <!-- Header -->
      <header class="git-header">
        <span class="branch">
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
              class="button"
              [disabled]="!canCommit()"
              (click)="commit()"
            >
              Commit
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
                          <span class="file-path" [appTooltip]="file.path">{{ fileName(file.path) }}</span>
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
                    @for (item of displayChangeItems(); track item.file.path) {
                      @if (item.kind === 'dir') {
                        <li
                          class="file-item unstaged"
                          [class.selected]="isSelected(item.file, false)"
                          (click)="selectFile(item.file, false)"
                        >
                          <span class="status-badge status-added">
                            <app-icon name="mdiFolder"></app-icon>
                          </span>
                          <div class="file-name-group">
                            <span class="file-path" [appTooltip]="item.file.path">{{ fileName(item.file.path) }}</span>
                          </div>
                          <span class="file-dir">{{ fileDir(item.file.path) }}</span>
                          @if (isDirLoading(item.file.path)) {
                            <span class="file-action-button loading-icon">
                              <app-icon name="mdiLoading"></app-icon>
                            </span>
                          } @else {
                            <button
                              type="button"
                              class="button icon-button file-action-button"
                              [appTooltip]="isDirExpanded(item.file.path) ? 'Collapse' : 'Show files'"
                              (click)="$event.stopPropagation(); toggleDirExpand(item.file)"
                            >
                              <app-icon [name]="isDirExpanded(item.file.path) ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
                            </button>
                          }
                          <button
                            type="button"
                            class="button icon-button file-action-button"
                            appTooltip="Stage directory"
                            (click)="$event.stopPropagation(); stageFile(item.file.path)"
                          >
                            <app-icon name="mdiPlus"></app-icon>
                          </button>
                        </li>
                      } @else {
                        <li
                          class="file-item unstaged"
                          [class.dir-child]="item.kind === 'dir-child'"
                          [class.selected]="isSelected(item.file, false)"
                          (click)="selectFile(item.file, false)"
                        >
                          <span
                            class="status-badge"
                            [class.status-edited]="isEditedStatus(item.file)"
                            [class.status-added]="isAddedStatus(item.file)"
                            [class.status-removed]="isRemovedStatus(item.file)"
                          >
                            <app-icon [name]="fileStatusIcon(item.file)"></app-icon>
                          </span>
                          <div class="file-name-group">
                            <span class="file-path" [appTooltip]="item.file.path">{{ fileName(item.file.path) }}</span>
                            @if (!item.file.isDirectory) {
                              <button
                                type="button"
                                class="button icon-button file-action-button open-in-editor-btn"
                                appTooltip="Open in editor"
                                (click)="$event.stopPropagation(); openInEditor(item.file)"
                              >
                                <app-icon name="mdiOpenInNew"></app-icon>
                              </button>
                            }
                          </div>
                          <span class="file-dir">{{ fileDir(item.file.path) }}</span>
                          @if (item.file.status !== '?') {
                            @if (isDiscardConfirmationPending(item.file.path)) {
                              <div
                                class="file-action-group"
                                (mouseleave)="cancelDiscardConfirmation()"
                              >
                                <button
                                  type="button"
                                  class="button icon-button file-action-button"
                                  appTooltip="Confirm discard changes"
                                  (click)="$event.stopPropagation(); confirmDiscardFile(item.file.path)"
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
                                (click)="$event.stopPropagation(); requestDiscardConfirmation(item.file.path)"
                              >
                                <app-icon name="mdiTrashCanOutline"></app-icon>
                              </button>
                            }
                          }
                          <button
                            type="button"
                            class="button icon-button file-action-button"
                            appTooltip="Stage"
                            (click)="$event.stopPropagation(); stageFile(item.file.path)"
                          >
                            <app-icon name="mdiPlus"></app-icon>
                          </button>
                        </li>
                      }
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
      } @else if (gitError() === 'no_commits') {
        <div class="git-unavailable">
          <app-icon name="mdiGit"></app-icon>
          <span>No commits yet</span>
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
      } @else if (gitError() === 'status_failed') {
        <div class="git-unavailable">
          <app-icon name="mdiAlert"></app-icon>
          <span>Git status failed</span>
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
        padding: 0.5rem 0;
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

      .git-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        gap: 0.75rem;
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

      .dir-child {
        padding-left: 1.5rem;
      }

      .loading-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--foreground-color-10t);
      }

      .loading-icon app-icon {
        width: 1.15rem;
        height: 1.15rem;
        animation: git-diff-spin 1s linear infinite;
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

  private readonly expandedDirsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly dirChildrenSignal = signal<ReadonlyMap<string, readonly GitFile[]>>(new Map());
  private readonly dirLoadingSignal = signal<ReadonlySet<string>>(new Set());

  readonly displayChangeItems = computed((): ChangeItem[] => {
    const items: ChangeItem[] = [];
    const expanded = this.expandedDirsSignal();
    const children = this.dirChildrenSignal();
    for (const file of this.changeFiles()) {
      items.push({ kind: file.isDirectory ? 'dir' : 'file', file });
      if (file.isDirectory && expanded.has(file.path)) {
        for (const child of children.get(file.path) ?? []) {
          items.push({ kind: 'dir-child', file: child });
        }
      }
    }
    return items;
  });
  readonly modifiedUnstagedCount = computed(
    () => this.status()?.unstaged.filter((file) => file.status !== "A").length ?? 0,
  );
  readonly addedUnstagedCount = computed(
    () =>
      (this.status()?.unstaged.filter((file) => file.status === "A").length ?? 0) +
      (this.status()?.untracked.length ?? 0),
  );

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
    private readonly opener: Opener,
  ) {
    effect(() => {
      const status = this.status();
      const sel = this.selectedFileSignal();
      if (!sel || !status) return;
      const allFiles = [...status.staged, ...status.unstaged, ...status.untracked];
      const stillExists = allFiles.some((f) => f.path === sel.file.path);
      if (!stillExists) this.closeDiff();
    });

    effect(() => {
      const status = this.status();
      if (!status) return;
      untracked(() => {
        for (const dirPath of this.expandedDirsSignal()) {
          void this.fetchDirChildren(dirPath);
        }
      });
    });
  }

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
    return sel?.file.path === file.path && sel?.isStaged === isStaged;
  }

  fileStatusIcon(file: GitFile): Icon {
    if (file.isDirectory) return "mdiFolder";
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

    if (file.isDirectory) {
      this.diffLoadingSignal.set(false);
      this.diffSignal.set(null);
      return;
    }

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

  isDirExpanded(path: string): boolean {
    return this.expandedDirsSignal().has(path);
  }

  isDirLoading(path: string): boolean {
    return this.dirLoadingSignal().has(path);
  }

  toggleDirExpand(file: GitFile): void {
    const expanded = new Set(this.expandedDirsSignal());
    if (expanded.has(file.path)) {
      expanded.delete(file.path);
      this.expandedDirsSignal.set(expanded);
    } else {
      expanded.add(file.path);
      this.expandedDirsSignal.set(expanded);
      void this.fetchDirChildren(file.path);
    }
  }

  private async fetchDirChildren(dirPath: string): Promise<void> {
    const loading = new Set(this.dirLoadingSignal());
    loading.add(dirPath);
    this.dirLoadingSignal.set(loading);
    try {
      const children = await this.gitStatusService.listFilesInDir(dirPath);
      const childMap = new Map(this.dirChildrenSignal());
      childMap.set(dirPath, children);
      this.dirChildrenSignal.set(childMap);
    } finally {
      const loading2 = new Set(this.dirLoadingSignal());
      loading2.delete(dirPath);
      this.dirLoadingSignal.set(loading2);
    }
  }

  private async loadDiff(file: GitFile, isStaged: boolean): Promise<void> {
    const status = this.status();
    if (!status) {
      this.diffLoadingSignal.set(false);
      return;
    }

    const snapshot = status.shellContext;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    try {
      const diff = await this.gitDiffService.loadDiff(
        file.path,
        isStaged,
        file.status === "D",
        status.gitRoot,
        snapshot,
      );
      if (!this.isSelected(file, isStaged)) return;
      this.diffSignal.set(diff);
    } finally {
      if (this.isSelected(file, isStaged)) {
        this.diffLoadingSignal.set(false);
      }
    }
  }
}
