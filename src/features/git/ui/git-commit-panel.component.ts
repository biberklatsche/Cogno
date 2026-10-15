import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from "@angular/core";
import { ClipboardAccess } from "@cogno/platform";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState } from "../git-view-state.service";
import { GitCommitDetail, GitFile } from "../model/git-model";
import { GitFileListComponent } from "./git-file-list.component";
import { formatCommitTime } from "./git-format";
import { GIT_SHARED_STYLES } from "./git-styles";

/** A commit or stash: its message, author, parents and the files it changed. */
@Component({
  selector: "app-git-commit-panel",
  standalone: true,
  imports: [IconComponent, TooltipDirective, GitFileListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (detail(); as commit) {
      <header class="panel-header">
        <span class="subtle">{{ stashRef() ?? "commit" }}:</span>
        <button type="button" class="link mono" appTooltip="Copy commit sha" (click)="clipboard.writeText(commit.sha)">
          {{ commit.sha.slice(0, 7) }}
        </button>
        <span class="grow"></span>
        <button type="button" class="button icon-button"
                [appTooltip]="view.fileListMode() === 'tree' ? 'Show as paths' : 'Show as tree'"
                (click)="toggleFileListMode()">
          <app-icon [name]="view.fileListMode() === 'tree' ? 'mdiFormatListBulleted' : 'mdiFileTree'"></app-icon>
        </button>
      </header>
      <div class="scroll">
        <div class="message">
          <div class="subject">{{ subject() }}</div>
          @if (body()) {
            <pre class="body">{{ body() }}</pre>
          }
        </div>
        <div class="meta">
          <div>
            <strong>{{ commit.author }}</strong>
            <span class="subtle"> authored {{ time(commit.authorTime) }}</span>
          </div>
          @if (commit.committer !== commit.author || commit.commitTime !== commit.authorTime) {
            <div class="subtle">{{ commit.committer }} committed {{ time(commit.commitTime) }}</div>
          }
          @if (!stashRef()) {
            <div class="parents">
              <span class="subtle">{{ commit.parents.length > 1 ? "parents:" : "parent:" }}</span>
              @for (parent of commit.parents; track parent) {
                <button type="button" class="link mono" (click)="view.revealCommit(parent)">{{ parent.slice(0, 7) }}</button>
              }
            </div>
          }
        </div>
        <div class="section-header">
          <span>{{ summary() }}</span>
        </div>
        <app-git-file-list kind="commit" [files]="commit.files" [mode]="view.fileListMode()"
                           [selectedPath]="selectedPath()"
                           (open)="openDiff($event, commit)"
                           (menu)="actions.openCommitFileMenu($event.event, $event.file, commit.sha)"></app-git-file-list>
      </div>
    } @else if (loading()) {
      <div class="empty">Loading commit…</div>
    } @else {
      <div class="empty">Commit not found</div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host { display: flex; flex-direction: column; min-height: 0; height: 100%; }
      .scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .message { padding: var(--git-gutter); }
      .subject { font-weight: 600; white-space: pre-wrap; word-break: break-word; }
      .body {
        margin: 0.5rem 0 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: inherit;
        color: var(--git-subtle);
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0 var(--git-gutter) var(--git-gutter);
        border-bottom: 1px solid var(--git-border);
      }
      .parents { display: flex; gap: 0.4rem; align-items: center; }
      .link {
        background: none;
        border: none;
        padding: 0;
        color: var(--highlight-color);
        cursor: pointer;
      }
    `,
  ],
})
export class GitCommitPanelComponent {
  readonly sha = input.required<string>();
  /** Set for a stash: its ref, shown instead of "commit". */
  readonly stashRef = input<string | null>(null);

  readonly detail = signal<GitCommitDetail | null>(null);
  readonly loading = signal(false);

  readonly subject = computed(() => this.detail()?.message.split("\n")[0] ?? "");
  readonly body = computed(
    () => this.detail()?.message.split("\n").slice(1).join("\n").trim() ?? "",
  );
  readonly summary = computed(() => {
    const files = this.detail()?.files ?? [];
    const count = (statuses: string[]) =>
      files.filter((file) => statuses.includes(file.status)).length;
    const parts = [
      [count(["M"]), "modified"],
      [count(["A"]), "added"],
      [count(["D"]), "deleted"],
      [count(["R", "C"]), "renamed"],
    ]
      .filter(([value]) => (value as number) > 0)
      .map(([value, label]) => `${value} ${label}`);
    return parts.length > 0 ? parts.join(" · ") : "No file changes";
  });

  constructor(
    readonly repository: GitRepositoryService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
    readonly clipboard: ClipboardAccess,
  ) {
    effect(() => {
      void this.load(this.sha());
    });
  }

  selectedPath(): string | null {
    const diff = this.view.diff();
    return diff?.kind === "commit" && diff.sha === this.sha() ? diff.file.path : null;
  }

  openDiff(file: GitFile, commit: GitCommitDetail): void {
    this.actions.showDiff({
      kind: "commit",
      file,
      sha: commit.sha,
      parent: commit.parents[0] ?? null,
    });
  }

  toggleFileListMode(): void {
    this.view.fileListMode.update((mode) => (mode === "tree" ? "path" : "tree"));
  }

  time(seconds: number): string {
    return formatCommitTime(seconds);
  }

  private async load(sha: string): Promise<void> {
    this.loading.set(true);
    this.detail.set(null);
    try {
      const detail = await this.repository.loadCommitDetail(sha);
      // A newer selection replaced this one while git was running.
      if (sha === this.sha()) this.detail.set(detail);
    } finally {
      if (sha === this.sha()) this.loading.set(false);
    }
  }
}
