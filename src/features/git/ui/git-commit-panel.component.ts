import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from "@angular/core";
import { ClipboardAccess } from "@cogno/platform";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitAvatarService } from "../git-avatar.service";
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
      <div class="message">
        <div class="subject">{{ subject() }}</div>
        @if (body()) {
          <pre class="body">{{ body() }}</pre>
        }
      </div>
      <div class="meta">
        @if (avatars.url(commit.email); as avatar) {
          <img class="avatar" [src]="avatar" alt="" [appTooltip]="commit.email"
               (error)="avatars.markFailed(commit.email)" />
        } @else {
          <span class="avatar" [appTooltip]="commit.email">{{ initials(commit.author) }}</span>
        }
        <div class="who">
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
      </div>
      <div class="section-header files-header">
        <span>{{ summary() }}</span>
      </div>
      <div class="files">
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
      /* Three parts, each its own block: the message as a boxed text that
         scrolls after a few lines, the author line, and the files taking the rest. */
      .message {
        flex: 0 0 auto;
        max-height: calc(6 * 1.5em + 2 * var(--git-gutter));
        overflow: auto;
        margin: var(--git-gutter);
        padding: var(--git-gutter);
        line-height: 1.5;
        background: var(--git-hover);
        border: 1px solid var(--git-border);
        border-radius: var(--button-border-radius);
      }
      /* Avatar on the left, name and parents beside it, as GitKraken lays it out. */
      .meta {
        flex: 0 0 auto;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--git-gutter);
        padding: 0.4rem var(--git-gutter);
        border-bottom: 1px solid var(--git-border);
      }
      .who { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
      .avatar {
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: var(--git-font-small);
        line-height: 1;
        letter-spacing: 0.02em;
        color: var(--background-color);
        background: var(--highlight-color);
      }
      .files-header {
        flex: 0 0 auto;
        background: var(--git-hover);
        border-bottom: 1px solid var(--git-border);
      }
      .files { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .subject { white-space: pre-wrap; word-break: break-word; }
      .body {
        margin: 0.5rem 0 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: inherit;
        color: var(--git-subtle);
      }
      .parents { display: flex; gap: 0.4rem; align-items: center; }
      .link {
        background: none;
        border: none;
        padding: 0;
        color: var(--highlight-color);
        text-underline-offset: 2px;
      }
      .link:hover { text-decoration: underline; }
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
    readonly avatars: GitAvatarService,
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

  /** Up to two letters of the name, standing in while there is no avatar to show. */
  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return `${first}${last}`.toUpperCase();
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
