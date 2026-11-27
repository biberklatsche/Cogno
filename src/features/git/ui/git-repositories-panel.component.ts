import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SessionApi } from "@cogno/core/api/session-api";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { groupByWorkspace, TerminalId, TerminalPlacement } from "@cogno/shared/domain";
import {
  ContextMenuOverlayService,
  IconComponent,
  TabChipComponent,
  TileComponent,
  TooltipDirective,
  WorkspaceGroupComponent,
} from "@cogno/shared/ui";
import {
  GitRepositoriesOverviewService,
  GitRepositoryTile,
} from "../git-repositories-overview.service";
import { GIT_SHARED_STYLES } from "./git-styles";

/**
 * The repositories of all open terminals, grouped by workspace in tab order;
 * terminals of one workspace in the same repository share a tile. A tile names
 * the repository, the branch, how many files are new, changed and gone, and
 * bottom right the tab, as the coding agent cards do: the first, with all of
 * them in the tooltip and an arrow beside it when there are more; a click
 * there then opens a menu to go to one. Clicking the tile focuses its first terminal
 * (or keeps the focused one, if it is among them), and the panel follows the
 * focus to that repository.
 */
@Component({
  selector: "app-git-repositories-panel",
  standalone: true,
  imports: [
    IconComponent,
    TooltipDirective,
    TileComponent,
    TabChipComponent,
    WorkspaceGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="panel-header">
      <span class="ellipsis grow">Repositories</span>
      <span class="count">{{ overview.tiles().length }}</span>
    </header>
    <div class="list">
      @if (overview.tiles().length === 0) {
        <div class="empty">No open repositories</div>
      }
      @for (group of groups(); track group.workspaceId) {
        <app-workspace-group [name]="group.workspaceName" [color]="group.workspaceColor ?? ''">
        @for (tile of group.items; track tile.root) {
          <button
            type="button"
            appTile
            class="tile"
            [focused]="isFocused(tile)"
            (click)="open(tile)"
          >
            <span class="repository ellipsis" [appTooltip]="tile.root">{{ repositoryName(tile) }}</span>
            <span class="branch" [appTooltip]="branchLabel(tile)">
              <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
              <span class="ellipsis">{{ branchLabel(tile) }}</span>
            </span>
            <span class="footer">
              <span class="counts mono">
                <span class="status-added" [class.none]="tile.counts.added === 0">+{{ tile.counts.added }}</span>
                <span class="status-edited" [class.none]="tile.counts.modified === 0">~{{ tile.counts.modified }}</span>
                <span class="status-removed" [class.none]="tile.counts.deleted === 0">−{{ tile.counts.deleted }}</span>
              </span>
              @if (tile.tabs[0]; as first) {
                <span class="tabs" (click)="chooseTab($event, tile)">
                  <app-tab-chip
                    class="tab"
                    [title]="tabTitle(first)"
                    [color]="first.tabColor"
                    [tooltip]="tabsTooltip(tile)"
                  ></app-tab-chip>
                  @if (tile.tabs.length > 1) {
                    <app-icon class="small-icon subtle" name="mdiChevronDown"></app-icon>
                  }
                </span>
              }
            </span>
          </button>
        }
        </app-workspace-group>
      }
    </div>
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .count { color: var(--git-subtle); font-size: var(--git-font-small); }
      .list {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0 var(--git-gutter) var(--git-gutter);
      }
      .tile { width: 100%; gap: 0.25rem; padding: 0.5rem 0.65rem; }
      .repository { color: var(--git-subtle); font-size: var(--git-font-small); }
      .branch {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
      }
      /* As on the coding agent cards: the tab sits bottom right. */
      .footer { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
      .counts { display: flex; gap: 0.6rem; flex-shrink: 0; }
      .counts .none { color: var(--git-subtle); }
      .tabs {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
        max-width: 60%;
        margin-left: auto;
        font-size: var(--git-font-small);
      }
      .tab { min-width: 0; }
    `,
  ],
})
export class GitRepositoriesPanelComponent {
  readonly groups = computed(() =>
    groupByWorkspace(this.overview.tiles(), (tile) => tile.placement),
  );
  private readonly focusedTerminalIdSignal = signal<string | undefined>(undefined);
  readonly focusedTerminalId = this.focusedTerminalIdSignal.asReadonly();

  constructor(
    readonly overview: GitRepositoriesOverviewService,
    private readonly navigator: TerminalNavigator,
    private readonly contextMenu: ContextMenuOverlayService,
    sessionApi: SessionApi,
    destroyRef: DestroyRef,
  ) {
    // The tile of the bound terminal is the one the rest of the panel shows.
    sessionApi.boundSession$.pipe(takeUntilDestroyed(destroyRef)).subscribe((boundSession) => {
      this.focusedTerminalIdSignal.set(
        boundSession.status === "active" ? boundSession.session.identity.terminalId : undefined,
      );
    });
  }

  /** The last path segment of the root. */
  repositoryName(tile: GitRepositoryTile): string {
    return tile.root.split(/[\\/]/).filter(Boolean).pop() ?? tile.root;
  }

  /** A tab as its header names it; one without a name by its place, as tabs are counted. */
  tabTitle(tab: TerminalPlacement): string {
    return tab.tabTitle || `Tab ${tab.tabIndex + 1}`;
  }

  /** Every tab of the tile, one per line: the chip cuts a long name short. */
  tabsTooltip(tile: GitRepositoryTile): string {
    return tile.tabs.map((tab) => this.tabTitle(tab)).join("\n");
  }

  branchLabel(tile: GitRepositoryTile): string {
    if (tile.branch) return tile.branch;
    return tile.sha ? `HEAD ${tile.sha.slice(0, 7)}` : "No commits";
  }

  isFocused(tile: GitRepositoryTile): boolean {
    const focused = this.focusedTerminalId();
    return focused !== undefined && tile.terminalIds.includes(focused);
  }

  open(tile: GitRepositoryTile): void {
    const target = this.isFocused(tile) ? this.focusedTerminalId() : tile.terminalIds[0];
    if (target) this.goTo(target);
  }

  /**
   * A click on the tabs of a tile that has several: a menu of them under the
   * chip, to go to one. With a single tab the click is the tile's.
   */
  chooseTab(event: MouseEvent, tile: GitRepositoryTile): void {
    if (tile.tabs.length < 2) return;
    event.stopPropagation();
    this.contextMenu.openAtElement(event.currentTarget as HTMLElement, {
      items: tile.tabs.map((tab) => ({
        label: this.tabTitle(tab),
        action: () => this.goTo(tab.terminalId),
      })),
    });
  }

  private goTo(terminalId: TerminalId): void {
    this.navigator.navigateToTerminal(terminalId).catch((error: unknown) => {
      console.error("[git-repositories] Failed to navigate to terminal:", error);
    });
  }
}
