import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GitOperationsService } from "../git-operations.service";
import { GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitViewState } from "../git-view-state.service";
import { GitBranch, GitRemoteBranch } from "../model/git-model";
import { GIT_SHARED_STYLES } from "./git-styles";

type Section = "local" | "remote" | "stashes" | "tags";

/**
 * The left panel: local branches, remotes with their branches, stashes and
 * tags. A click shows the commit in the graph, a double click checks a branch
 * out, and every row has its context menu.
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
    <div class="scroll">
      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('local')">
          <app-icon class="small-icon" [name]="isOpen('local') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiLaptop"></app-icon>
          Local
        </button>
        <span class="grow"></span>
        <span class="count">{{ branches().length }}</span>
      </div>
      @if (isOpen("local")) {
        @for (branch of branches(); track branch.name) {
          <div class="row ref" [class.selected]="isSelected(branch.sha)" [class.head]="branch.name === head().branch"
               (click)="view.revealCommit(branch.sha)" (dblclick)="checkout(branch)"
               (contextmenu)="actions.openBranchMenu($event, branch)">
            @if (branch.name === head().branch) {
              <app-icon class="small-icon head-icon" name="mdiCheck" appTooltip="Checked out"></app-icon>
            } @else {
              <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
            }
            <span class="ellipsis grow">{{ branch.name }}</span>
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
      }

      <div class="section-header">
        <button type="button" class="toggle" (click)="toggle('remote')">
          <app-icon class="small-icon" [name]="isOpen('remote') ? 'mdiChevronDown' : 'mdiChevronRight'"></app-icon>
          <app-icon class="small-icon" name="mdiCloudOutline"></app-icon>
          Remote
        </button>
        <span class="grow"></span>
        <button type="button" class="button icon-button header-action" appTooltip="Add a remote" (click)="actions.addRemote()">
          <app-icon name="mdiPlus"></app-icon>
        </button>
      </div>
      @if (isOpen("remote")) {
        @for (remote of remotes(); track remote.name) {
          <div class="row" [appTooltip]="remote.url" (click)="toggleRemote(remote.name)"
               (contextmenu)="actions.openRemoteMenu($event, remote)">
            <app-icon class="small-icon subtle" [name]="collapsedRemotes().has(remote.name) ? 'mdiChevronRight' : 'mdiChevronDown'"></app-icon>
            <app-icon class="small-icon subtle" name="mdiSourceRepository"></app-icon>
            <span class="ellipsis grow">{{ remote.name }}</span>
          </div>
          @if (!collapsedRemotes().has(remote.name)) {
            @for (remoteBranch of remoteBranchesOf(remote.name); track remoteBranch.name) {
              <div class="row ref nested" [class.selected]="isSelected(remoteBranch.sha)"
                   (click)="view.revealCommit(remoteBranch.sha)" (dblclick)="operations.checkoutRemoteBranch(remoteBranch)"
                   (contextmenu)="actions.openRemoteBranchMenu($event, remoteBranch)">
                <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
                <span class="ellipsis grow">{{ remoteBranch.shortName }}</span>
              </div>
            }
          }
        }
      }

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
        @for (stash of stashes(); track stash.sha) {
          <div class="row ref" [class.selected]="isStashSelected(stash.sha)"
               (click)="view.select({ kind: 'stash', sha: stash.sha, ref: stash.ref })"
               (dblclick)="operations.applyStash(stash.ref)"
               (contextmenu)="actions.openStashMenu($event, stash)">
            <app-icon class="small-icon subtle" name="mdiArchiveOutline"></app-icon>
            <span class="ellipsis grow" [appTooltip]="stash.ref">{{ stash.message }}</span>
          </div>
        }
      }

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
        @for (tag of tags(); track tag.name) {
          <div class="row ref" [class.selected]="isSelected(tag.sha)"
               (click)="view.revealCommit(tag.sha)" (contextmenu)="actions.openTagMenu($event, tag)">
            <app-icon class="small-icon subtle" name="mdiTagOutline"></app-icon>
            <span class="ellipsis grow">{{ tag.name }}</span>
          </div>
        }
      }
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
      .scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
      .grow { flex: 1; }
      .count { font-weight: normal; padding-right: 0.25rem; }
      .header-action { width: 1.4rem; height: 1.4rem; padding: 0.15rem; }
      .row.ref { padding-left: 1.4rem; }
      .row.nested { padding-left: 2.3rem; }
      .row.head { font-weight: 600; }
      .head-icon { color: var(--color-green); }
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
  private readonly closedSections = signal<ReadonlySet<Section>>(new Set());
  readonly collapsedRemotes = signal<ReadonlySet<string>>(new Set());

  readonly head = this.repository.head;
  readonly branches = computed(() => this.matching(this.repository.refs().branches, (b) => b.name));
  readonly remoteBranches = computed(() =>
    this.matching(this.repository.refs().remoteBranches, (b) => b.name),
  );
  readonly remotes = computed(() => {
    const withBranches = new Set(this.remoteBranches().map((b) => b.remote));
    return this.repository
      .remotes()
      .filter((r) => !this.filter().trim() || withBranches.has(r.name));
  });
  readonly stashes = computed(() => this.matching(this.repository.stashes(), (s) => s.message));
  readonly tags = computed(() => this.matching(this.repository.refs().tags, (t) => t.name));

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {}

  remoteBranchesOf(remote: string): GitRemoteBranch[] {
    return this.remoteBranches().filter((branch) => branch.remote === remote);
  }

  isOpen(section: Section): boolean {
    return !this.closedSections().has(section);
  }

  toggle(section: Section): void {
    this.closedSections.update((closed) => toggled(closed, section));
  }

  toggleRemote(remote: string): void {
    this.collapsedRemotes.update((collapsed) => toggled(collapsed, remote));
  }

  isSelected(sha: string): boolean {
    const selection = this.view.selection();
    return selection.kind === "commit" && selection.sha === sha;
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
