import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from "@angular/cdk/scrolling";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  untracked,
  viewChild,
} from "@angular/core";
import { IconComponent, TooltipDirective } from "@cogno/shared/ui";
import { GIT_LOG_PAGE_SIZE, GitRepositoryService } from "../git-repository.service";
import { GitUiActions } from "../git-ui-actions.service";
import { GitGraphColumn, GitViewState } from "../git-view-state.service";
import { GraphRow, GraphSegment } from "../model/git-graph";
import { GitCommit, GitRefLabel } from "../model/git-model";
import { formatCommitTime, graphColor } from "./git-format";
import { GIT_SHARED_STYLES } from "./git-styles";

const ROW_HEIGHT = 26;
const LANE_WIDTH = 14;
/** The graph column grows with the lanes up to this many, then clips. */
const MAX_VISIBLE_LANES = 12;
/** Room for the "Graph" header even with a single lane. */
const MIN_GRAPH_LANES = 3;
const MIN_COLUMN_WIDTH = 40;
const MAX_COLUMN_WIDTH = 800;
const DEFAULT_WIDTHS: Readonly<Record<Exclude<GitGraphColumn, "graph">, number>> = {
  refs: 144,
  author: 128,
  date: 152,
  sha: 72,
};

type Resize = { column: GitGraphColumn; startX: number; startWidth: number; handle: HTMLElement };

type GraphItem = {
  readonly commit: GitCommit;
  readonly row: GraphRow;
  readonly labels: ReadonlyArray<GitRefLabel>;
};

/**
 * The commit graph: one row per commit with its branch and tag labels, the
 * lanes, message, author, date and sha. Only the visible rows are rendered.
 * The "// WIP" row on top stands for the working tree.
 */
@Component({
  selector: "app-git-graph",
  standalone: true,
  imports: [
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    IconComponent,
    NgTemplateOutlet,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[style.--w-refs.px]": "width('refs')",
    "[style.--w-graph.px]": "width('graph')",
    "[style.--w-author.px]": "width('author')",
    "[style.--w-date.px]": "width('date')",
    "[style.--w-sha.px]": "width('sha')",
  },
  template: `
    <div class="columns header section-header">
      <span class="col-refs">Branch / Tag<ng-container *ngTemplateOutlet="resizer; context: { $implicit: 'refs' }"></ng-container></span>
      <span class="col-graph">Graph<ng-container *ngTemplateOutlet="resizer; context: { $implicit: 'graph' }"></ng-container></span>
      <span class="col-message">Commit Message</span>
      <span class="col-author">Author<ng-container *ngTemplateOutlet="resizer; context: { $implicit: 'author' }"></ng-container></span>
      <span class="col-date">Date / Time<ng-container *ngTemplateOutlet="resizer; context: { $implicit: 'date' }"></ng-container></span>
      <span class="col-sha">SHA<ng-container *ngTemplateOutlet="resizer; context: { $implicit: 'sha' }"></ng-container></span>
    </div>
    <ng-template #resizer let-column>
      <span class="resizer" (pointerdown)="startResize(column, $event)" (pointermove)="resize($event)"
            (pointerup)="endResize($event)" (pointercancel)="endResize($event)" (dblclick)="resetWidth(column)"></span>
    </ng-template>

    <div class="columns row wip" [class.selected]="view.selection().kind === 'wip'" (click)="view.select({ kind: 'wip' })">
      <span class="col-refs"></span>
      <span class="col-graph">
        <svg [attr.width]="width('graph')" [attr.height]="rowHeight">
          <circle [attr.cx]="laneX(0)" [attr.cy]="rowHeight / 2" r="5" class="wip-node"></circle>
        </svg>
      </span>
      <span class="col-message ellipsis subtle">
        // WIP
        @if (repository.changeCount() > 0) {
          <span class="wip-count">{{ repository.changeCount() }} changed</span>
        }
      </span>
    </div>

    <cdk-virtual-scroll-viewport class="viewport" [itemSize]="rowHeight" [minBufferPx]="400" [maxBufferPx]="800">
      <div *cdkVirtualFor="let item of items(); trackBy: trackBySha; templateCacheSize: 0"
           class="columns row" [class.selected]="isSelected(item.commit.sha)"
           [class.head]="item.commit.sha === repository.head().sha"
           (click)="view.select({ kind: 'commit', sha: item.commit.sha })"
           (contextmenu)="actions.openCommitMenu($event, item.commit)">
        <span class="col-refs">
          @if (item.labels.length > 0) {
            <span class="label small" [style.--lane-color]="color(item.row.color)"
                  [class.head-label]="item.labels[0].isHead"
                  [appTooltip]="labelTooltip(item.labels)"
                  (contextmenu)="openLabelMenu($event, item.labels[0])">
              <app-icon class="label-icon" [name]="labelIcon(item.labels[0])"></app-icon>
              <span class="ellipsis">{{ item.labels[0].name }}</span>
            </span>
            @if (item.labels.length > 1) {
              <span class="more small subtle" [appTooltip]="labelTooltip(item.labels)">+{{ item.labels.length - 1 }}</span>
            }
          }
        </span>
        <span class="col-graph">
          <svg [attr.width]="width('graph')" [attr.height]="rowHeight">
            @for (segment of item.row.segments; track $index) {
              <path [attr.d]="segmentPath(segment)" [attr.stroke]="color(segment.color)"></path>
            }
            <circle [attr.cx]="laneX(item.row.lane)" [attr.cy]="rowHeight / 2"
                    [attr.r]="item.commit.parents.length > 1 ? 3 : 5"
                    [attr.fill]="color(item.row.color)"
                    [class.head-node]="item.commit.sha === repository.head().sha"></circle>
          </svg>
        </span>
        <span class="col-message ellipsis" [class.subtle]="item.commit.parents.length > 1">{{ item.commit.subject }}</span>
        <span class="col-author ellipsis subtle" [appTooltip]="item.commit.email">{{ item.commit.author }}</span>
        <span class="col-date ellipsis subtle">{{ time(item.commit.timestamp) }}</span>
        <span class="col-sha mono subtle">{{ item.commit.sha.slice(0, 7) }}</span>
      </div>
    </cdk-virtual-scroll-viewport>
    @if (repository.hasMoreCommits()) {
      <div class="load-more">
        <button type="button" class="button" (click)="repository.loadMoreCommits()">
          Load {{ pageSize }} more commits
        </button>
      </div>
    }
  `,
  styles: [
    GIT_SHARED_STYLES,
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        min-width: 0;
        height: 100%;
        container-type: inline-size;
      }
      .columns {
        display: grid;
        grid-template-columns:
          var(--w-refs) var(--w-graph) minmax(6rem, 1fr) var(--w-author) var(--w-date) var(--w-sha);
        align-items: center;
        column-gap: var(--git-gutter);
        padding: 0 var(--git-gutter);
      }
      @container (max-width: 760px) {
        .columns { grid-template-columns: var(--w-refs) var(--w-graph) minmax(6rem, 1fr) var(--w-date); }
        .col-author, .col-sha { display: none; }
      }
      @container (max-width: 520px) {
        .columns { grid-template-columns: var(--w-refs) var(--w-graph) minmax(6rem, 1fr); }
        .col-date { display: none; }
      }
      .columns > span { position: relative; min-width: 0; }
      .header {
        border-bottom: 1px solid var(--git-border);
      }
      .header > span { overflow: hidden; white-space: nowrap; }
      .resizer {
        position: absolute;
        top: 0;
        bottom: 0;
        right: calc(var(--git-gutter) * -0.5 - 3px);
        width: 7px;
        cursor: col-resize;
        touch-action: none;
      }
      .resizer:hover, .resizer.active { background: var(--highlight-color); opacity: 0.5; }
      .row { height: var(--git-row-height); display: grid; }
      .row.head .col-message { font-weight: 600; }
      .viewport { flex: 1 1 auto; min-height: 0; }
      .col-graph { height: var(--git-row-height); overflow: hidden; }
      .col-graph svg { display: block; }
      .col-graph path { fill: none; stroke-width: 2; }
      .head-node { stroke: var(--foreground-color); stroke-width: 2; }
      .wip-node { fill: none; stroke: var(--git-subtle); stroke-width: 2; stroke-dasharray: 3 2; }
      .wip-count { margin-left: var(--git-gutter); font-style: italic; }
      .col-refs { display: flex; align-items: center; gap: 0.25rem; overflow: hidden; }
      .label {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        min-width: 0;
        max-width: 100%;
        padding: 0 0.35rem;
        border-radius: 3px;
        line-height: 18px;
        background: color-mix(in srgb, var(--lane-color) 25%, transparent);
        border: 1px solid color-mix(in srgb, var(--lane-color) 60%, transparent);
      }
      .label.head-label { font-weight: 600; }
      .label-icon { width: 12px; height: 12px; flex: 0 0 auto; }
      .load-more { display: flex; justify-content: center; padding: 0.3rem; border-top: 1px solid var(--git-border); }
    `,
  ],
})
export class GitGraphComponent {
  readonly rowHeight = ROW_HEIGHT;
  readonly pageSize = GIT_LOG_PAGE_SIZE;
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  readonly items = computed<GraphItem[]>(() => {
    const rows = this.repository.graph();
    const labels = this.repository.refLabels();
    return this.repository.commits().map((commit, index) => ({
      commit,
      row: rows[index] as GraphRow,
      labels: labels.get(commit.sha) ?? [],
    }));
  });
  /** The graph column follows the lanes unless the user dragged it. */
  private readonly graphWidth = computed(() => {
    const lanes = this.repository.graph().reduce((max, row) => Math.max(max, row.width), 1);
    const visible = Math.min(Math.max(lanes, MIN_GRAPH_LANES), MAX_VISIBLE_LANES);
    return visible * LANE_WIDTH + LANE_WIDTH / 2;
  });
  private resizing: Resize | null = null;

  constructor(
    readonly repository: GitRepositoryService,
    readonly actions: GitUiActions,
    readonly view: GitViewState,
  ) {
    effect(() => {
      const sha = this.view.reveal();
      const commits = this.repository.commits();
      const viewport = this.viewport();
      if (!sha || !viewport) return;
      const index = commits.findIndex((commit) => commit.sha === sha);
      if (index === -1) return;
      untracked(() => {
        viewport.scrollToIndex(Math.max(0, index - 3));
        this.view.reveal.set(null);
      });
    });
  }

  trackBySha = (_index: number, item: GraphItem) => item.commit.sha;

  width(column: GitGraphColumn): number {
    const dragged = this.view.columnWidths()[column];
    if (dragged !== undefined) return dragged;
    return column === "graph" ? this.graphWidth() : DEFAULT_WIDTHS[column];
  }

  startResize(column: GitGraphColumn, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("active");
    this.resizing = { column, startX: event.clientX, startWidth: this.width(column), handle };
  }

  resize(event: PointerEvent): void {
    const resizing = this.resizing;
    if (!resizing) return;
    const width = resizing.startWidth + event.clientX - resizing.startX;
    this.view.columnWidths.update((widths) => ({
      ...widths,
      [resizing.column]: Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width))),
    }));
  }

  endResize(event: PointerEvent): void {
    const resizing = this.resizing;
    if (!resizing) return;
    resizing.handle.releasePointerCapture(event.pointerId);
    resizing.handle.classList.remove("active");
    this.resizing = null;
  }

  /** Back to the default width, or for the graph to following the lanes. */
  resetWidth(column: GitGraphColumn): void {
    this.view.columnWidths.update(({ [column]: _dropped, ...rest }) => rest);
  }

  isSelected(sha: string): boolean {
    const selection = this.view.selection();
    return selection.kind === "commit" && selection.sha === sha;
  }

  laneX(lane: number): number {
    return lane * LANE_WIDTH + LANE_WIDTH / 2 + 2;
  }

  /** A straight line, or a curve between two lanes in the half of the row it belongs to. */
  segmentPath(segment: GraphSegment): string {
    const x1 = this.laneX(segment.from);
    const x2 = this.laneX(segment.to);
    const middle = ROW_HEIGHT / 2;
    const [y1, y2] = segment.half === "top" ? [0, middle] : [middle, ROW_HEIGHT];
    if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const bend = (y2 - y1) / 2;
    return `M ${x1} ${y1} C ${x1} ${y1 + bend} ${x2} ${y2 - bend} ${x2} ${y2}`;
  }

  color(index: number): string {
    return graphColor(index);
  }

  time(seconds: number): string {
    return formatCommitTime(seconds);
  }

  labelIcon(label: GitRefLabel): "mdiTagOutline" | "mdiCloudOutline" | "mdiLaptop" {
    if (label.kind === "tag") return "mdiTagOutline";
    return label.kind === "remote" ? "mdiCloudOutline" : "mdiLaptop";
  }

  labelTooltip(labels: ReadonlyArray<GitRefLabel>): string {
    return labels.map((label) => label.name).join(", ");
  }

  openLabelMenu(event: MouseEvent, label: GitRefLabel): void {
    const refs = this.repository.refs();
    if (label.kind === "branch") {
      const branch = refs.branches.find((b) => b.name === label.name);
      if (branch) this.actions.openBranchMenu(event, branch);
    } else if (label.kind === "remote") {
      const remoteBranch = refs.remoteBranches.find((b) => b.name === label.name);
      if (remoteBranch) this.actions.openRemoteBranchMenu(event, remoteBranch);
    } else {
      const tag = refs.tags.find((t) => t.name === label.name);
      if (tag) this.actions.openTagMenu(event, tag);
    }
  }
}
