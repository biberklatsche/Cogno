import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  untracked,
} from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState, GitWipFileGroup } from "../git-view-state.service";
import { GitFile } from "../model/git-model";
import { GitFileListComponent } from "./git-file-list.component";
import { toggled } from "./git-format";
import { GIT_SHARED_STYLES } from "./git-styles";

/** The working tree: conflicts, unstaged and staged files, and the commit form. */
@Component({
  selector: "app-git-wip-panel",
  standalone: true,
  imports: [IconComponent, TooltipDirective, GitFileListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="panel-header" [class.merging]="merging()">
      @if (merging()) {
        <span class="merge-title grow">
          <span class="merge-state" [class.conflicts]="status().conflicted.length > 0">
            @if (status().conflicted.length > 0) {
              <app-icon class="small-icon" name="mdiAlert"></app-icon>
              Merge conflicts detected
            } @else {
              Conflicts resolved - ready to merge
            }
          </span>
          <span class="ellipsis merge-sides">
            Merging <span class="ref">{{ repository.incoming()?.name ?? repository.incoming()?.sha?.slice(0, 7) ?? "?" }}</span>
            into <span class="ref">{{ repository.head().branch ?? "detached HEAD" }}</span>
          </span>
        </span>
      } @else {
        <span class="ellipsis grow">
          {{ repository.changeCount() }} file changes on
          <strong>{{ repository.head().branch ?? "detached HEAD" }}</strong>
        </span>
      }
      <button type="button" class="button icon-button"
              [appTooltip]="view.fileListMode() === 'tree' ? 'Show as paths' : 'Show as tree'"
              (click)="view.toggleFileListMode()">
        <app-icon [name]="view.fileListMode() === 'tree' ? 'mdiFormatListBulleted' : 'mdiFileTree'"></app-icon>
      </button>
    </header>

    <div class="lists">
      @if (status().conflicted.length > 0) {
        <section class="section" [class.open]="isOpen('conflicted')">
        <div class="section-header">
          <button type="button" class="toggle" (click)="toggle('conflicted')">
            <app-icon class="small-icon" [name]="isOpen('conflicted') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
            Conflicted Files ({{ status().conflicted.length }})
          </button>
          <span class="grow"></span>
          <button type="button" class="button small" (click)="markAllResolved()">Mark All Resolved</button>
        </div>
        @if (isOpen("conflicted")) {
          <app-git-file-list class="body" kind="conflicted" [files]="status().conflicted" [mode]="view.fileListMode()"
                             [selectedPath]="selectedPath('unstaged')"
                             (open)="openDiff($event, 'unstaged')"
                             (primary)="actions.markResolved($event)"
                             (menu)="actions.openWipFileMenu($event.event, $event.file, 'conflicted')"></app-git-file-list>
        }
        </section>
      }

      <section class="section" [class.open]="isOpen('unstaged')">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('unstaged')">
          <app-icon class="small-icon" [name]="isOpen('unstaged') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          Unstaged Files ({{ unstaged().length }})
        </button>
        <span class="grow"></span>
        <button type="button" class="button icon-button" appTooltip="Discard all unstaged changes"
                [disabled]="unstaged().length === 0" (click)="actions.discardAllUnstaged()">
          <app-icon name="mdiTrashCanOutline"></app-icon>
        </button>
        <button type="button" class="button small" [disabled]="unstaged().length === 0" (click)="operations.stageAll()">
          Stage All Changes
        </button>
      </div>
      @if (isOpen("unstaged")) {
        <app-git-file-list class="body" kind="unstaged" [files]="unstaged()" [mode]="view.fileListMode()"
                           [selectedPath]="selectedPath('unstaged')"
                           (open)="openDiff($event, 'unstaged')"
                           (primary)="operations.stage($event)"
                           (discard)="actions.discardFile($event)"
                           (menu)="actions.openWipFileMenu($event.event, $event.file, 'unstaged')"></app-git-file-list>
      }
      </section>

      <section class="section" [class.open]="isOpen('staged')">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('staged')">
          <app-icon class="small-icon" [name]="isOpen('staged') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          {{ merging() ? "Resolved Files" : "Staged Files" }} ({{ status().staged.length }})
        </button>
        <span class="grow"></span>
        <button type="button" class="button small" [disabled]="status().staged.length === 0" (click)="operations.unstageAll()">
          Unstage All Changes
        </button>
      </div>
      @if (isOpen("staged")) {
        <app-git-file-list class="body" kind="staged" [files]="status().staged" [mode]="view.fileListMode()"
                           [selectedPath]="selectedPath('staged')"
                           (open)="openDiff($event, 'staged')"
                           (primary)="operations.unstage($event)"
                           (menu)="actions.openWipFileMenu($event.event, $event.file, 'staged')"></app-git-file-list>
      }
      </section>
    </div>

    <form class="commit" (submit)="$event.preventDefault(); commit()">
      <div class="message">
        <input class="summary" type="text" placeholder="Commit summary" spellcheck="false"
               [value]="summary()" (input)="summary.set(value($event))" />
        <textarea class="description" placeholder="Description"
                  [value]="description()" (input)="description.set(value($event))"></textarea>
      </div>
      <div class="commit-actions">
        <button type="submit" class="button commit commit-button" [disabled]="!canCommit() || committing()">
          @if (committing()) {
            <app-icon name="mdiLoading" class="spin"></app-icon>
            Committing…
          } @else {
            {{ commitLabel() }}
          }
        </button>
        @if (merging()) {
          <button type="button" class="button abort-button" [disabled]="committing()"
                  (click)="operations.abortOperation('merge')">Abort Merge</button>
        }
      </div>
    </form>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        height: 100%;
      }
      /* An accordion as in GitKraken: the headers stay in view, the open lists share the
         height equally and each scrolls on its own. */
      .lists { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
      .section { display: flex; flex-direction: column; flex: 0 0 auto; min-height: 0; }
      .section.open { flex: 1 1 0; }
      .section-header { flex: 0 0 auto; border-top: 1px solid var(--git-border); }
      .section:first-child .section-header { border-top: none; }
      .body { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .grow { flex: 1; }
      .commit {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: var(--git-gutter);
        border-top: 1px solid var(--git-border);
      }
      /* Summary and description as one field, as in GitKraken: one frame around both, the
         summary larger than the description. */
      .message {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.4rem 0.5rem;
        background: var(--background-color);
        border: 1px solid var(--git-border);
        border-radius: var(--button-border-radius);
      }
      .message:focus-within { border-color: var(--highlight-color); }
      .summary, .description {
        padding: 0;
        border: none;
        outline: none;
        background: none;
        color: var(--foreground-color);
        font: inherit;
      }
      .summary { font-size: 1.1em; }
      .description {
        height: 64px;
        font-size: var(--git-font-small);
        resize: none;
      }
      .commit-actions { display: flex; gap: 0.4rem; }
      .commit-actions .button { flex: 1 1 0; }
      .abort-button {
        color: var(--color-red);
        border-color: color-mix(in srgb, var(--color-red) 60%, transparent);
      }
      .abort-button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-red) 14%, var(--background-color));
      }
      .panel-header.merging { padding-top: 0.3rem; padding-bottom: 0.3rem; }
      .merge-title { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
      .merge-state { display: inline-flex; align-items: center; gap: 0.3rem; }
      .merge-state.conflicts { color: var(--color-yellow); }
      .merge-sides { font-size: var(--git-font-small); }
      .ref {
        padding: 0 0.3rem;
        border-radius: 2px;
        background: color-mix(in srgb, var(--highlight-color) 25%, transparent);
      }
      .commit-button {
        align-self: stretch;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
      }
      .commit-button app-icon { width: 1rem; height: 1rem; }
    `,
  ],
})
export class GitWipPanelComponent {
  readonly status = this.repository.status;
  readonly unstaged = computed(() => [...this.status().unstaged, ...this.status().untracked]);

  readonly summary = signal("");
  readonly description = signal("");
  /** The commit and the re-read after it are running; the button waits for both. */
  readonly committing = signal(false);
  /** The message git prepared, as last put in the form. */
  private prepared: { readonly summary: string; readonly description: string } | null = null;

  /** A merge stopped for conflicts or for its commit. */
  readonly merging = computed(() => this.repository.operation() === "merge");
  /** A merge commits even with nothing staged: taking the current side everywhere is a merge too. */
  readonly canCommit = computed(
    () =>
      this.summary().trim().length > 0 &&
      this.status().conflicted.length === 0 &&
      (this.status().staged.length > 0 || this.merging()),
  );
  readonly commitLabel = computed(() => {
    if (this.merging()) {
      return this.status().conflicted.length > 0
        ? "Resolve Conflicts to Merge"
        : "Commit and Merge";
    }
    const staged = this.status().staged.length;
    return staged === 0
      ? "Stage Changes to Commit"
      : `Commit Changes to ${staged} File${staged === 1 ? "" : "s"}`;
  });

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {
    // A merge, cherry pick or revert that stopped has its message ready; the
    // form shows it, as `git commit` in a terminal would - again for each
    // stop (the next commit of a cherry pick), and gone once the operation ends.
    effect(() => {
      const stopped = this.repository.operation() !== null;
      this.repository.incoming()?.sha;
      untracked(() => void this.syncPreparedMessage(stopped));
    });
  }

  isOpen(group: GitWipFileGroup): boolean {
    return !this.view.closedWipGroups().has(group);
  }

  toggle(group: GitWipFileGroup): void {
    this.view.closedWipGroups.update((closed) => toggled(closed, group));
  }

  selectedPath(kind: "unstaged" | "staged"): string | null {
    const diff = this.view.diff();
    return diff?.kind === kind ? diff.file.path : null;
  }

  openDiff(file: GitFile, kind: "unstaged" | "staged"): void {
    this.actions.showDiff({ kind, file });
  }

  markAllResolved(): Promise<void> {
    return this.actions.markResolved(this.status().conflicted.map((file) => file.path));
  }

  /** Puts git's prepared message in the form, or takes it out; what the person typed stays. */
  private async syncPreparedMessage(stopped: boolean): Promise<void> {
    if (!this.formIsPrepared()) return;
    const message = stopped ? await this.repository.readMergeMessage() : null;
    if (!this.formIsPrepared()) return;
    const [summary = "", ...rest] = (message ?? "").split("\n");
    const description = rest.join("\n").trim();
    this.prepared = message ? { summary, description } : null;
    this.summary.set(summary);
    this.description.set(description);
  }

  /** The form is empty or still holds the prepared message unchanged. */
  private formIsPrepared(): boolean {
    const summary = this.summary();
    const description = this.description();
    if (!summary && !description) return true;
    return this.prepared?.summary === summary && this.prepared.description === description;
  }

  async commit(): Promise<void> {
    if (!this.canCommit() || this.committing()) return;
    this.committing.set(true);
    try {
      const outcome = await this.operations.commit(this.summary(), this.description());
      if (outcome !== "ok") return;
      this.summary.set("");
      this.description.set("");
      this.view.closeDiff();
    } finally {
      this.committing.set(false);
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
