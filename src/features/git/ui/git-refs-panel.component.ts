import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  WritableSignal,
} from "@angular/core";
import { Icon, IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitRefsSection, GitViewState } from "../git-view-state.service";
import { GitBranchSort, nextSort, sortBranches } from "../model/git-branch-sort";
import { GitBranch, GitRemoteBranch } from "../model/git-model";
import { GIT_SHARED_STYLES } from "./git-styles";

const SORT_BUTTONS: Readonly<Record<GitBranchSort, { icon: Icon; label: string }>> = {
  "date-desc": { icon: "mdiSortClockDescendingOutline", label: "Newest commit first" },
  "date-asc": { icon: "mdiSortClockAscendingOutline", label: "Oldest commit first" },
  "name-asc": { icon: "mdiSortAlphabeticalAscending", label: "Name A to Z" },
  "name-desc": { icon: "mdiSortAlphabeticalDescending", label: "Name Z to A" },
};

/**
 * The left panel: local branches, remotes with their branches, stashes and
 * tags, the checked-out branch highlighted. A click shows the commit in the
 * graph without marking the row, a double click checks a branch
 * out, and every row has its context menu. The branch sections sort by date
 * or name with the default branches on top, and delete the shown ones in bulk.
 */
@Component({
  selector: "app-git-refs-panel",
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter">
      <app-icon class="small-icon subtle" name="mdiMagnify"></app-icon>
      <input class="text-input" type="text" placeholder="Filter" spellcheck="false"
             [value]="filter()" (input)="filter.set(value($event))" (keydown.escape)="clearFilter($event)" />
    </div>
    <div class="sections">
      <section class="section">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('local')">
          <app-icon class="small-icon" [name]="isOpen('local') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiLaptop"></app-icon>
          Local
        </button>
        <span class="grow"></span>
        <button type="button" class="button icon-button header-action" [appTooltip]="sortLabel(localSort())"
                (click)="stepSort(localSort)">
          <app-icon [name]="sortIcon(localSort())"></app-icon>
        </button>
        <button type="button" class="button icon-button header-action" appTooltip="Delete the shown branches"
                [disabled]="branches().length === 0" (click)="actions.deleteLocalBranches(branches())">
          <app-icon name="mdiTrashCanOutline"></app-icon>
        </button>
        <span class="count">{{ branches().length }}</span>
      </div>
      @if (isOpen("local")) {
        <div class="body">
        @for (branch of branches(); track branch.name) {
          <div class="row ref" [class.selected]="branch.name === head().branch"
               (click)="view.revealCommit(branch.sha)" (dblclick)="checkout(branch)"
               (contextmenu)="actions.openBranchMenu($event, branch)">
            @if (branch.name === head().branch) {
              <app-icon class="small-icon head-icon" name="mdiEyeOutline" appTooltip="Checked out"></app-icon>
            }
            <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
            <span class="ellipsis grow" [appTooltip]="branch.name">{{ branch.name }}</span>
            @if (branch.upstreamGone) {
              <span class="subtle track" appTooltip="The upstream branch was deleted">gone</span>
            }
            @if (branch.behind > 0) {
              <span class="track" [appTooltip]="branch.behind + ' behind'">{{ branch.behind }}<app-icon class="track-icon" name="mdiArrowDown"></app-icon></span>
            }
            @if (branch.ahead > 0) {
              <span class="track" [appTooltip]="branch.ahead + ' ahead'">{{ branch.ahead }}<app-icon class="track-icon" name="mdiArrowUp"></app-icon></span>
            }
          </div>
        }
        </div>
      }
      </section>

      <section class="section">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('remote')">
          <app-icon class="small-icon" [name]="isOpen('remote') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiCloudOutline"></app-icon>
          Remote
        </button>
        <span class="grow"></span>
        <button type="button" class="button icon-button header-action" [appTooltip]="sortLabel(remoteSort())"
                (click)="stepSort(remoteSort)">
          <app-icon [name]="sortIcon(remoteSort())"></app-icon>
        </button>
        <button type="button" class="button icon-button header-action" appTooltip="Delete the shown branches on their remotes"
                [disabled]="visibleRemoteBranches().length === 0" (click)="actions.deleteRemoteBranches(visibleRemoteBranches())">
          <app-icon name="mdiTrashCanOutline"></app-icon>
        </button>
        <button type="button" class="button icon-button header-action" appTooltip="Add a remote" (click)="actions.addRemote()">
          <app-icon name="mdiPlus"></app-icon>
        </button>
      </div>
      @if (isOpen("remote")) {
        <div class="body">
        @for (remote of remotes(); track remote.name) {
          <div class="row" [appTooltip]="remote.url" (click)="toggleRemote(remote.name)"
               (contextmenu)="actions.openRemoteMenu($event, remote)">
            <app-icon class="small-icon subtle" [name]="collapsedRemotes().has(remote.name) ? 'mdiChevronRight' : 'mdiChevronDown'"></app-icon>
            <app-icon class="small-icon subtle" name="mdiSourceRepository"></app-icon>
            <span class="ellipsis grow">{{ remote.name }}</span>
          </div>
          @if (!collapsedRemotes().has(remote.name)) {
            @for (remoteBranch of remoteBranchesOf(remote.name); track remoteBranch.name) {
              <div class="row ref nested"
                   (click)="view.revealCommit(remoteBranch.sha)" (dblclick)="operations.checkoutRemoteBranch(remoteBranch)"
                   (contextmenu)="actions.openRemoteBranchMenu($event, remoteBranch)">
                <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
                <span class="ellipsis grow" [appTooltip]="remoteBranch.name">{{ remoteBranch.shortName }}</span>
              </div>
            }
          }
        }
        </div>
      }
      </section>

      <section class="section">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('stashes')">
          <app-icon class="small-icon" [name]="isOpen('stashes') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiArchiveOutline"></app-icon>
          Stashes
        </button>
        <span class="grow"></span>
        <span class="count">{{ stashes().length }}</span>
      </div>
      @if (isOpen("stashes")) {
        <div class="body">
        @for (stash of stashes(); track stash.sha) {
          <div class="row ref" [class.selected]="isStashSelected(stash.sha)"
               (click)="view.select({ kind: 'stash', sha: stash.sha, ref: stash.ref })"
               (dblclick)="operations.applyStash(stash.ref)"
               (contextmenu)="actions.openStashMenu($event, stash)">
            <app-icon class="small-icon subtle" name="mdiArchiveOutline"></app-icon>
            <span class="ellipsis grow" [appTooltip]="stash.ref">{{ stash.message }}</span>
          </div>
        }
        </div>
      }
      </section>

      <section class="section">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('tags')">
          <app-icon class="small-icon" [name]="isOpen('tags') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiTagOutline"></app-icon>
          Tags
        </button>
        <span class="grow"></span>
        <span class="count">{{ tags().length }}</span>
      </div>
      @if (isOpen("tags")) {
        <div class="body">
        @for (tag of tags(); track tag.name) {
          <div class="row ref"
               (click)="view.revealCommit(tag.sha)" (contextmenu)="actions.openTagMenu($event, tag)">
            <app-icon class="small-icon subtle" name="mdiTagOutline"></app-icon>
            <span class="ellipsis grow" [appTooltip]="tag.name">{{ tag.name }}</span>
          </div>
        }
        </div>
      }
      </section>
    </div>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host { display: flex; flex-direction: column; min-height: 0; height: 100%; }
      .filter {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-height: 32px;
        padding: 0 var(--git-gutter);
        border-bottom: 1px solid var(--git-border);
      }
      .filter .text-input { padding: 0.15rem 0.4rem; }
      /* An accordion as in GitKraken: the four headers always stay in view, every open section
         scrolls on its own. The open sections share the height equally, but none takes more
         than its rows need, so the rest goes to the ones that scroll. Grid rows growing up to
         max-content do exactly that; a flex item with max-height: max-content collapses to its
         header in WebKit (the macOS webview). The one column is capped at the panel width, or long
         names would widen it instead of being cut off. */
      .sections {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: minmax(0, max-content);
        align-content: start;
        flex: 1 1 auto;
        min-height: 0;
      }
      .section { display: flex; flex-direction: column; min-height: 0; }
      .body { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .grow { flex: 1; }
      /* Sections read as blocks: a rule and some air between them, the count in the highlight colour. */
      .section-header { flex: 0 0 auto; border-top: 1px solid var(--git-border); margin-top: 0.35rem; }
      .section:first-child .section-header { border-top: none; margin-top: 0; }
      .count { color: var(--highlight-color); padding-right: 0.25rem; }
      .header-action { width: 1.4rem; height: 1.4rem; padding: 0.15rem; }
      .row.ref { position: relative; padding-left: 1.6rem; }
      .row.nested { padding-left: 2.5rem; }
      /* The checked-out mark sits in the indent, in front of the branch icon. */
      .head-icon { position: absolute; left: 0.4rem; color: var(--color-green); }
      .track {
        display: inline-flex;
        align-items: center;
        font-size: var(--git-font-small);
        color: var(--git-subtle);
      }
      .track-icon { width: 11px; height: 11px; }
    `,
  ],
})
export class GitRefsPanelComponent {
  readonly filter = signal("");
  readonly collapsedRemotes = signal<ReadonlySet<string>>(new Set());

  readonly localSort = signal<GitBranchSort>("date-desc");
  readonly remoteSort = signal<GitBranchSort>("date-desc");

  readonly head = this.repository.head;
  readonly branches = computed(() => {
    const refs = this.repository.refs();
    return sortBranches(
      this.matching(refs.branches, (b) => b.name),
      this.localSort(),
      refs,
    );
  });
  readonly remoteBranches = computed(() => {
    const refs = this.repository.refs();
    return sortBranches(
      this.matching(refs.remoteBranches, (b) => b.name),
      this.remoteSort(),
      refs,
    );
  });
  readonly remotes = computed(() => {
    const withBranches = new Set(this.remoteBranches().map((b) => b.remote));
    return this.repository
      .remotes()
      .filter((r) => !this.filter().trim() || withBranches.has(r.name));
  });
  /** The remote branches a bulk delete offers: those of expanded remotes. */
  readonly visibleRemoteBranches = computed(() => {
    const collapsed = this.collapsedRemotes();
    return this.remoteBranches().filter((b) => !collapsed.has(b.remote));
  });
  readonly stashes = computed(() => this.matching(this.repository.stashes(), (s) => s.message));
  readonly tags = computed(() => this.matching(this.repository.refs().tags, (t) => t.name));

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {}

  sortIcon(sort: GitBranchSort): Icon {
    return SORT_BUTTONS[sort].icon;
  }

  sortLabel(sort: GitBranchSort): string {
    return `${SORT_BUTTONS[sort].label}, click for ${SORT_BUTTONS[nextSort(sort)].label.toLowerCase()}`;
  }

  stepSort(sort: WritableSignal<GitBranchSort>): void {
    sort.update(nextSort);
  }

  remoteBranchesOf(remote: string): GitRemoteBranch[] {
    return this.remoteBranches().filter((branch) => branch.remote === remote);
  }

  isOpen(section: GitRefsSection): boolean {
    return !this.view.closedSections().has(section);
  }

  toggle(section: GitRefsSection): void {
    this.view.closedSections.update((closed) => toggled(closed, section));
  }

  toggleRemote(remote: string): void {
    this.collapsedRemotes.update((collapsed) => toggled(collapsed, remote));
  }

  isStashSelected(sha: string): boolean {
    const selection = this.view.selection();
    return selection.kind === "stash" && selection.sha === sha;
  }

  checkout(branch: GitBranch): void {
    if (branch.name !== this.head().branch) void this.operations.checkoutBranch(branch.name);
  }

  clearFilter(event: Event): void {
    if (!this.filter()) return;
    // Escape clears the filter first; only an empty filter lets it close the panel.
    event.stopPropagation();
    this.filter.set("");
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private matching<T>(items: ReadonlyArray<T>, text: (item: T) => string): T[] {
    const query = this.filter().trim().toLowerCase();
    return query ? items.filter((item) => text(item).toLowerCase().includes(query)) : [...items];
  }
}

function toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
