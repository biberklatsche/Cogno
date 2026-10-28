import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  signal,
} from "@angular/core";
import { IconComponent } from "@cogno/shared/ui";
import { GitOperationsService } from "./git-operations.service";
import { GitRepositoryService } from "./git-repository.service";
import { GitUiActions } from "./git-ui-actions.service";
import { GitSidePanel, GitViewState } from "./git-view-state.service";
import { GitCommitPanelComponent } from "./ui/git-commit-panel.component";
import { GitDiffPanelComponent } from "./ui/git-diff-panel.component";
import { GitGraphComponent } from "./ui/git-graph.component";
import { GitRefsPanelComponent } from "./ui/git-refs-panel.component";
import { GIT_SHARED_STYLES } from "./ui/git-styles";
import { GitToolbarComponent } from "./ui/git-toolbar.component";
import { GitWipPanelComponent } from "./ui/git-wip-panel.component";

/** Below this panel width the branches panel becomes a drawer over the graph. */
const NARROW_WIDTH_PX = 760;
const MIN_PANEL_WIDTH = 160;
/** What the graph in the middle keeps at least while a side panel is dragged wider. */
const MIN_CENTER_WIDTH = 240;

type PanelResize = {
  panel: GitSidePanel;
  startX: number;
  startWidth: number;
  /** How wide the panel may get before the middle falls below its minimum. */
  maxWidth: number;
  handle: HTMLElement;
};

/**
 * The git panel of the focused terminal's repository, laid out like
 * GitKraken's main view: toolbar on top, branches on the left, the commit
 * graph - or a file's diff in its place - in the middle and the working tree
 * or the selected commit on the right.
 */
@Component({
  selector: "app-git-side",
  standalone: true,
  imports: [
    IconComponent,
    GitToolbarComponent,
    GitRefsPanelComponent,
    GitGraphComponent,
    GitDiffPanelComponent,
    GitWipPanelComponent,
    GitCommitPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[style.--git-refs-width]": "panelWidth('refs')",
    "[style.--git-detail-width]": "panelWidth('detail')",
  },
  template: `
    @if (repository.root()) {
      <app-git-toolbar></app-git-toolbar>

      @if (repository.operation(); as operation) {
        <div class="banner">
          <app-icon class="small-icon" name="mdiAlert"></app-icon>
          <span class="ellipsis">{{ operationLabel() }}</span>
          <span class="grow"></span>
          <button type="button" class="button small" (click)="operations.abortOperation(operation)">Abort</button>
          @if (operation === "rebase" || operation === "cherry-pick") {
            <button type="button" class="button small" (click)="operations.skipCommit(operation)">Skip Commit</button>
          }
          <button type="button" class="button small primary" [disabled]="repository.status().conflicted.length > 0"
                  (click)="operations.continueOperation(operation)">Continue</button>
        </div>
      }

      <div class="body" [class.narrow]="narrow()" [class.with-refs]="view.refsVisible()">
        @if (view.refsVisible()) {
          <app-git-refs-panel class="refs"></app-git-refs-panel>
        }
        <div class="center">
          @if (view.diff()) {
            <app-git-diff-panel></app-git-diff-panel>
          } @else {
            <app-git-graph></app-git-graph>
          }
        </div>
        <div class="detail">
          @switch (view.selection().kind) {
            @case ("wip") {
              <app-git-wip-panel></app-git-wip-panel>
            }
            @case ("commit") {
              <app-git-commit-panel [sha]="selectedSha()"></app-git-commit-panel>
            }
            @case ("stash") {
              <app-git-commit-panel [sha]="selectedSha()" [stashRef]="selectedStashRef()"></app-git-commit-panel>
            }
          }
        </div>
        @if (!narrow()) {
          @if (view.refsVisible()) {
            <span class="splitter refs-splitter"
                  (pointerdown)="startResize('refs', $event)" (pointermove)="resize($event)"
                  (pointerup)="endResize($event)" (pointercancel)="endResize($event)"
                  (dblclick)="resetWidth('refs')"></span>
          }
          <span class="splitter detail-splitter"
                (pointerdown)="startResize('detail', $event)" (pointermove)="resize($event)"
                (pointerup)="endResize($event)" (pointercancel)="endResize($event)"
                (dblclick)="resetWidth('detail')"></span>
        }
      </div>
    } @else {
      <div class="unavailable">
        @switch (repository.error()) {
          @case ("not_installed") {
            <app-icon name="mdiAlert"></app-icon>
            <span>Git is not installed or not in PATH</span>
          }
          @case ("unavailable") {
            <app-icon name="mdiGit"></app-icon>
            <span>Git is not available in a remote session</span>
          }
          @case ("status_failed") {
            <app-icon name="mdiAlert"></app-icon>
            <span>Git status failed</span>
          }
          @case ("no_repo") {
            <app-icon name="mdiGit"></app-icon>
            <span>Not a git repository</span>
            <div class="start">
              <button type="button" class="button" (click)="actions.init()">Initialize a repository here</button>
              <button type="button" class="button" (click)="actions.clone()">Clone a repository</button>
            </div>
          }
          @default {
            <app-icon name="mdiGit"></app-icon>
            <span>{{ repository.loading() ? "Reading repository…" : "No terminal focused" }}</span>
          }
        }
      </div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        font-size: var(--panel-font-size);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }
      .banner {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.3rem 0.5rem;
        background: color-mix(in srgb, var(--color-yellow) 15%, transparent);
        border-bottom: 1px solid var(--git-border);
      }
      .banner .grow { flex: 1; }
      .button.small { padding: 0.1rem 0.6rem; font-size: 0.85em; }
      /* The side panels follow the available width until the user drags them. */
      .body {
        --refs-width: var(--git-refs-width, clamp(11rem, 18%, 16rem));
        --detail-width: var(--git-detail-width, clamp(16rem, 30%, 24rem));
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--detail-width);
        grid-template-areas: "center detail";
      }
      .body.with-refs {
        grid-template-columns: var(--refs-width) minmax(0, 1fr) var(--detail-width);
        grid-template-areas: "refs center detail";
      }
      .refs { grid-area: refs; min-height: 0; border-right: 1px solid var(--git-border); }
      .center { grid-area: center; min-height: 0; min-width: 0; }
      .detail { grid-area: detail; min-height: 0; min-width: 0; border-left: 1px solid var(--git-border); }
      /* The drag handles sit over the two dividers; the divider itself lights up while dragging. */
      .splitter {
        position: absolute;
        z-index: 3;
        top: 0;
        bottom: 0;
        width: 7px;
        cursor: col-resize;
        touch-action: none;
      }
      .refs-splitter { left: calc(var(--refs-width) - 4px); }
      .detail-splitter { right: calc(var(--detail-width) - 4px); }
      .splitter::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 3px;
        width: 1px;
        background: var(--git-border);
      }
      .splitter.active::before { width: 2px; left: 2.5px; background: var(--highlight-color); }

      /* Narrow: graph above, details below; branches slide in over the graph. */
      .body.narrow, .body.narrow.with-refs {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
        grid-template-areas: "center" "detail";
      }
      .body.narrow .detail { border-left: none; border-top: 1px solid var(--git-border); }
      .body.narrow .refs {
        position: absolute;
        z-index: 2;
        top: 0;
        bottom: 0;
        left: 0;
        width: min(16rem, 80%);
        background: var(--background-color);
        box-shadow: 4px 0 12px rgba(0, 0, 0, 0.3);
      }

      .unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        flex: 1;
        color: var(--git-subtle);
        text-align: center;
        padding: 1rem;
      }
      .unavailable > app-icon { width: 1.5rem; height: 1.5rem; opacity: 0.4; }
      .start { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 0.5rem; }
    `,
  ],
})
export class GitSideComponent implements OnDestroy {
  readonly narrow = signal(false);
  readonly selectedSha = computed(() => {
    const selection = this.view.selection();
    return selection.kind === "wip" ? "" : selection.sha;
  });
  readonly selectedStashRef = computed(() => {
    const selection = this.view.selection();
    return selection.kind === "stash" ? selection.ref : null;
  });
  readonly operationLabel = computed(() => {
    const conflicts = this.repository.status().conflicted.length;
    const what = {
      merge: "Merge in progress",
      rebase: "Rebase in progress",
      "cherry-pick": "Cherry pick in progress",
      revert: "Revert in progress",
    }[this.repository.operation() ?? "merge"];
    return conflicts > 0
      ? `${what} - ${conflicts} conflicted file${conflicts === 1 ? "" : "s"} to resolve`
      : `${what} - resolved, ready to continue`;
  });

  private readonly resizeObserver: ResizeObserver;
  private resizing: PanelResize | null = null;

  constructor(
    readonly repository: GitRepositoryService,
    readonly operations: GitOperationsService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
    private readonly host: ElementRef<HTMLElement>,
  ) {
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const narrow = (entry?.contentRect.width ?? 0) < NARROW_WIDTH_PX;
      if (narrow === this.narrow()) return;
      this.narrow.set(narrow);
      // The branches are a column when there is room and a drawer when there is not.
      this.view.refsVisible.set(!narrow);
    });
    this.resizeObserver.observe(host.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
  }

  /** The dragged width as a CSS length, or null to leave the panel its default. */
  panelWidth(panel: GitSidePanel): string | null {
    const width = this.view.panelWidths()[panel];
    return width === undefined ? null : `${width}px`;
  }

  startResize(panel: GitSidePanel, event: PointerEvent): void {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const element = this.host.nativeElement.querySelector<HTMLElement>(
      panel === "refs" ? ".refs" : ".detail",
    );
    const body = this.host.nativeElement.querySelector<HTMLElement>(".body");
    if (!element || !body) return;
    const other = this.host.nativeElement.querySelector<HTMLElement>(
      panel === "refs" ? ".detail" : ".refs",
    );
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("active");
    this.resizing = {
      panel,
      startX: event.clientX,
      startWidth: element.getBoundingClientRect().width,
      maxWidth: body.clientWidth - (other?.getBoundingClientRect().width ?? 0) - MIN_CENTER_WIDTH,
      handle,
    };
  }

  resize(event: PointerEvent): void {
    const resizing = this.resizing;
    if (!resizing) return;
    // The branches panel grows to the right, the detail panel to the left.
    const delta = (event.clientX - resizing.startX) * (resizing.panel === "refs" ? 1 : -1);
    const width = Math.min(
      resizing.maxWidth,
      Math.max(MIN_PANEL_WIDTH, resizing.startWidth + delta),
    );
    this.view.panelWidths.update((widths) => ({ ...widths, [resizing.panel]: Math.round(width) }));
  }

  endResize(event: PointerEvent): void {
    const resizing = this.resizing;
    if (!resizing) return;
    resizing.handle.releasePointerCapture(event.pointerId);
    resizing.handle.classList.remove("active");
    this.resizing = null;
  }

  /** Back to following the available width. */
  resetWidth(panel: GitSidePanel): void {
    this.view.panelWidths.update(({ [panel]: _dropped, ...rest }) => rest);
  }
}
