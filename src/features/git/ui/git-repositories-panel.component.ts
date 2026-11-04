import { ChangeDetectionStrategy, Component, computed, DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SessionApi } from "@cogno/core/api/session-api";
import { TerminalNavigator } from "@cogno/core/api/terminal-navigator-port";
import { groupByWorkspace } from "@cogno/shared/domain";
import {
  IconComponent,
  TabChipComponent,
  TileComponent,
  TooltipDirective,
  WorkspaceGroupHeaderComponent,
} from "@cogno/shared/ui";
import {
  GitRepositoriesOverviewService,
  GitRepositoryTile,
} from "../git-repositories-overview.service";
import { GIT_SHARED_STYLES } from "./git-styles";

/**
 * The repositories of all open terminals, one tile per terminal, grouped by
 * workspace in tab order. A tile names the tab, the branch and how many files
 * are new, changed and gone; clicking it focuses the terminal, and the panel
 * follows the focus to that repository.
 */
@Component({
  selector: "app-git-repositories-panel",
  standalone: true,
  imports: [
    IconComponent,
    TooltipDirective,
    TileComponent,
    TabChipComponent,
    WorkspaceGroupHeaderComponent,
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
        @if (group.workspaceName) {
          <app-workspace-group-header
            class="group"
            [name]="group.workspaceName"
            [color]="group.workspaceColor ?? ''"
          ></app-workspace-group-header>
        }
        @for (tile of group.items; track tile.terminalId) {
          <button
            type="button"
            appTile
            class="tile"
            [focused]="tile.terminalId === focusedTerminalId()"
            (click)="open(tile)"
          >
            <app-tab-chip
              class="tab"
              [title]="tile.placement?.tabTitle || repositoryName(tile)"
              [color]="tile.placement?.tabColor"
              [tooltip]="tile.root"
            ></app-tab-chip>
            <span class="branch" [appTooltip]="branchLabel(tile)">
              <app-icon class="small-icon subtle" name="mdiSourceBranch"></app-icon>
              <span class="ellipsis">{{ branchLabel(tile) }}</span>
            </span>
            <span class="counts mono">
              <span class="status-added" [class.none]="tile.counts.added === 0">+{{ tile.counts.added }}</span>
              <span class="status-edited" [class.none]="tile.counts.modified === 0">~{{ tile.counts.modified }}</span>
              <span class="status-removed" [class.none]="tile.counts.deleted === 0">−{{ tile.counts.deleted }}</span>
            </span>
          </button>
        }
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
        gap: 0.4rem;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: var(--git-gutter);
      }
      .group { margin-top: 0.6rem; }
      .group:first-child { margin-top: 0; }
      .tile { width: 100%; gap: 0.25rem; padding: 0.5rem 0.65rem; }
      .tab { align-self: flex-start; max-width: 100%; font-size: var(--git-font-small); }
      .branch {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
      }
      .counts { display: flex; gap: 0.6rem; }
      .counts .none { color: var(--git-subtle); }
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

  /** The last path segment of the root, for a tab without a title. */
  repositoryName(tile: GitRepositoryTile): string {
    return tile.root.split(/[\\/]/).filter(Boolean).pop() ?? tile.root;
  }

  branchLabel(tile: GitRepositoryTile): string {
    if (tile.branch) return tile.branch;
    return tile.sha ? `HEAD ${tile.sha.slice(0, 7)}` : "No commits";
  }

  open(tile: GitRepositoryTile): void {
    this.navigator.navigateToTerminal(tile.terminalId).catch((error: unknown) => {
      console.error("[git-repositories] Failed to navigate to terminal:", error);
    });
  }
}
