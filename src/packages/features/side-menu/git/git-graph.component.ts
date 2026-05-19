import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  input,
  output,
  signal,
  ViewEncapsulation,
  viewChild,
} from "@angular/core";
import { GitCommitNode, GitRefInfo } from "./git-graph.service";

const LANE_W = 20;
const ROW_H = 28;
const DOT_R = 9;
const PAD_X = 12;
const PAD_Y = 14;
const TEXT_GAP = 10;
const COLORS = [
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-yellow)",
  "var(--color-cyan)",
  "var(--color-magenta)",
  "var(--color-red)",
  "var(--color-bright-blue)",
  "var(--color-bright-green)",
  "var(--color-bright-cyan)",
  "var(--color-bright-magenta)",
];

function col(lane: number): string {
  return COLORS[lane % COLORS.length];
}

function ns<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

@Component({
  selector: "app-git-graph",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="graph-col-headers">
      <div class="col-header" [style.width.px]="refColWidthPx()">
        <span class="col-label">Branch / Tag</span>
        <div class="col-resize-handle" (pointerdown)="startRefColResize($event)"></div>
      </div>
      <div class="col-header" [style.width.px]="effectiveGraphColWidthPx()">
        <span class="col-label">Graph</span>
        <div class="col-resize-handle" (pointerdown)="startGraphColResize($event)"></div>
      </div>
      <div class="col-header col-commits-header">
        <span class="col-label">Commits</span>
      </div>
    </div>
    <div class="git-graph-scroll" #scrollEl (scroll)="onScroll()">
      <div #container class="git-graph-inner" (click)="onSvgClick($event)"></div>
    </div>
  `,
  styles: [
    `
      app-git-graph {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: var(--background-color);
      }

      .graph-col-headers {
        flex: 0 0 auto;
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid var(--background-color-20l);
        background: var(--background-color);
        overflow: hidden;
      }

      .col-header {
        flex: 0 0 auto;
        position: relative;
        box-sizing: border-box;
        padding: 3px 6px;
        font-size: 10px;
        font-weight: 600;
        opacity: 0.55;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        overflow: hidden;
        white-space: nowrap;
        user-select: none;
      }

      .col-commits-header {
        flex: 1 1 auto;
      }

      .col-resize-handle {
        position: absolute;
        right: -3px;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: ew-resize;
        z-index: 2;
      }

      .col-resize-handle::after {
        content: "";
        position: absolute;
        top: 20%;
        bottom: 20%;
        left: 2px;
        width: 1px;
        background: var(--background-color-20l);
        transition: background 0.1s;
      }

      .col-resize-handle:hover::after,
      .col-resize-handle:active::after {
        background: var(--highlight-color, #4a9eff);
      }

      .git-graph-scroll {
        flex: 1 1 auto;
        overflow: auto;
        min-height: 0;
      }

      .git-graph-inner {
        padding: 0.25rem 0;
        display: inline-block;
        min-width: 100%;
      }

      app-git-graph svg {
        display: block;
      }

      app-git-graph text {
        fill: var(--foreground-color);
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        dominant-baseline: middle;
      }
    `,
  ],
})
export class GitGraphComponent {
  readonly commits = input<GitCommitNode[] | null>(null);
  readonly hasUncommittedChanges = input<boolean>(false);
  readonly selectedHash = input<string | null>(null);
  readonly loading = input<boolean>(false);
  readonly commitClick = output<string | null>();
  readonly loadMore = output<void>();
  private readonly container = viewChild<ElementRef<HTMLElement>>("container");
  private readonly scrollEl = viewChild<ElementRef<HTMLElement>>("scrollEl");

  readonly refColWidthPx = signal(150);
  readonly graphColWidthPx = signal(100);
  readonly effectiveGraphColWidthPx = signal(100);

  private refColResizeStartX = 0;
  private refColResizeStartWidth = 0;
  private graphColResizeStartX = 0;
  private graphColResizeStartWidth = 0;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => {
      window.removeEventListener("pointermove", this.onRefColMove, true);
      window.removeEventListener("pointerup", this.onRefColUp, true);
      window.removeEventListener("pointermove", this.onGraphColMove, true);
      window.removeEventListener("pointerup", this.onGraphColUp, true);
    });

    effect(() => {
      const commits = this.commits();
      const el = this.container()?.nativeElement;
      if (!el) return;
      el.innerHTML = "";
      if (!commits?.length) return;
      const refColW = this.refColWidthPx();
      const graphColW = this.graphColWidthPx();
      const svg = renderGraph(
        commits,
        this.hasUncommittedChanges(),
        refColW,
        graphColW,
        this.selectedHash(),
      );
      // Keep header graph column in sync with actual rendered width
      const { maxLane } = computeLayout(commits);
      const minGraphW = PAD_X + (maxLane + 1) * LANE_W + TEXT_GAP;
      this.effectiveGraphColWidthPx.set(Math.max(graphColW, minGraphW));
      el.appendChild(svg);
    });
  }

  onScroll(): void {
    if (this.loading()) return;
    const el = this.scrollEl()?.nativeElement;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      this.loadMore.emit();
    }
  }

  onSvgClick(e: Event): void {
    const hashEl = (e.target as Element).closest("[data-hash]");
    if (!hashEl) return;
    const hash = hashEl.getAttribute("data-hash");
    this.commitClick.emit(hash === "WIP" ? null : hash);
  }

  startRefColResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.refColResizeStartX = e.clientX;
    this.refColResizeStartWidth = this.refColWidthPx();
    window.addEventListener("pointermove", this.onRefColMove, true);
    window.addEventListener("pointerup", this.onRefColUp, true);
  }

  private readonly onRefColMove = (e: PointerEvent): void => {
    const delta = e.clientX - this.refColResizeStartX;
    this.refColWidthPx.set(Math.max(40, Math.min(400, this.refColResizeStartWidth + delta)));
  };

  private readonly onRefColUp = (): void => {
    window.removeEventListener("pointermove", this.onRefColMove, true);
    window.removeEventListener("pointerup", this.onRefColUp, true);
  };

  startGraphColResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.graphColResizeStartX = e.clientX;
    this.graphColResizeStartWidth = this.graphColWidthPx();
    window.addEventListener("pointermove", this.onGraphColMove, true);
    window.addEventListener("pointerup", this.onGraphColUp, true);
  }

  private readonly onGraphColMove = (e: PointerEvent): void => {
    const delta = e.clientX - this.graphColResizeStartX;
    this.graphColWidthPx.set(Math.max(40, Math.min(600, this.graphColResizeStartWidth + delta)));
  };

  private readonly onGraphColUp = (): void => {
    window.removeEventListener("pointermove", this.onGraphColMove, true);
    window.removeEventListener("pointerup", this.onGraphColUp, true);
  };
}

// ── Author avatar ────────────────────────────────────────────────────────────

const avatarCache = new Map<string, string>();

function authorAvatarUrl(author: string): string {
  const cached = avatarCache.get(author);
  if (cached) return cached;
  const words = author.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? (words[0][0]! + words[words.length - 1][0]!).toUpperCase()
      : (words[0]?.[0] ?? "?").toUpperCase();
  let h = 0;
  for (let i = 0; i < author.length; i++) h = (Math.imul(31, h) + author.charCodeAt(i)) | 0;
  const hue = (h >>> 0) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">` +
    `<circle cx="5" cy="5" r="5" fill="hsl(${hue},40%,42%)"/>` +
    `<text x="5" y="5.3" text-anchor="middle" dominant-baseline="central" ` +
    `fill="white" font-size="3.6" font-family="system-ui,sans-serif" font-weight="500">${initials}</text>` +
    `</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  avatarCache.set(author, url);
  return url;
}

// ── SVG rendering ────────────────────────────────────────────────────────────

function getCommitRefs(commit: GitCommitNode): GitRefInfo[] {
  return commit.refs.slice(0, 5);
}

function refRowWidth(refs: GitRefInfo[], isHEAD: boolean): number {
  if (refs.length === 0) return 0;
  let w = 0;
  for (const ref of refs) {
    const nameLen = isHEAD && ref.kind === "local" ? ref.name.length + 2 : ref.name.length;
    w += nameLen * 6.5 + 10 + 4;
  }
  return w - 4;
}

function renderGraph(
  commits: GitCommitNode[],
  hasUncommittedChanges: boolean,
  refColW: number,
  graphColW: number,
  selectedHash: string | null,
): SVGSVGElement {
  const { commitLane, commitRow, maxLane } = computeLayout(commits);

  const rowOffset = hasUncommittedChanges ? 1 : 0;
  const numLanes = maxLane + 1;
  const minGraphColW = PAD_X + numLanes * LANE_W + TEXT_GAP;
  const actualGraphColW = Math.max(graphColW, minGraphColW);

  const graphOffsetX = refColW;
  const textX = graphOffsetX + actualGraphColW;
  const svgH = (commits.length + rowOffset) * ROW_H + PAD_Y * 2;

  const svg = ns("svg");
  svg.setAttribute("height", String(svgH));
  svg.style.minWidth = `${textX + 450}px`;

  // Clip path: keeps ref badges contained within the branch column
  const defs = ns("defs");
  const clipPath = ns("clipPath");
  clipPath.setAttribute("id", "gc-ref-col");
  const clipRect = ns("rect");
  clipRect.setAttribute("x", "0");
  clipRect.setAttribute("y", "0");
  clipRect.setAttribute("width", String(Math.max(0, refColW - TEXT_GAP)));
  clipRect.setAttribute("height", String(svgH));
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  const highlightG = ns("g");
  svg.appendChild(highlightG);
  const lineG = ns("g");
  svg.appendChild(lineG);
  const commitG = ns("g");
  svg.appendChild(commitG);
  const hitG = ns("g");
  svg.appendChild(hitG);

  // ── WIP dot (uncommitted changes indicator) ───────────────────────────────
  if (hasUncommittedChanges) {
    if (selectedHash === "WIP") {
      const wipBg = ns("rect");
      wipBg.setAttribute("x", "0");
      wipBg.setAttribute("y", String(PAD_Y - ROW_H / 2));
      wipBg.setAttribute("width", "10000");
      wipBg.setAttribute("height", String(ROW_H));
      wipBg.setAttribute("fill", "var(--highlight-color-ct2)");
      highlightG.appendChild(wipBg);
    }
    const wipHit = ns("rect");
    wipHit.setAttribute("x", "0");
    wipHit.setAttribute("y", String(PAD_Y - ROW_H / 2));
    wipHit.setAttribute("width", "10000");
    wipHit.setAttribute("height", String(ROW_H));
    wipHit.setAttribute("fill", "none");
    wipHit.setAttribute("pointer-events", "all");
    wipHit.setAttribute("data-hash", "WIP");
    wipHit.style.cursor = "pointer";
    hitG.appendChild(wipHit);

    const headCommit = commits.find((c) => c.isHEAD) ?? commits[0];
    const headLane = headCommit ? (commitLane.get(headCommit.hash) ?? 0) : 0;
    const wipX = graphOffsetX + PAD_X + headLane * LANE_W;
    const wipY = PAD_Y;
    const headY = PAD_Y + ROW_H;

    const stub = ns("path");
    stub.setAttribute("fill", "none");
    stub.setAttribute("stroke", "#888");
    stub.setAttribute("stroke-width", "2");
    stub.setAttribute("stroke-dasharray", "4 3");
    stub.setAttribute("d", `M ${wipX} ${wipY + DOT_R} L ${wipX} ${headY - DOT_R}`);
    lineG.appendChild(stub);

    const dot = ns("circle");
    dot.setAttribute("cx", String(wipX));
    dot.setAttribute("cy", String(wipY));
    dot.setAttribute("r", String(DOT_R));
    dot.setAttribute("fill", "#666");
    dot.setAttribute("stroke", "#999");
    dot.setAttribute("stroke-width", "1.5");
    commitG.appendChild(dot);

    const wipLabel = ns("text");
    wipLabel.setAttribute("x", String(textX));
    wipLabel.setAttribute("y", String(wipY));
    wipLabel.setAttribute("fill", "#888");
    wipLabel.textContent = "Uncommitted changes";
    commitG.appendChild(wipLabel);
  }

  for (const commit of commits) {
    const commitRowIndex = commitRow.get(commit.hash);
    const lane = commitLane.get(commit.hash);
    if (commitRowIndex === undefined || lane === undefined) {
      continue;
    }
    const row = commitRowIndex + rowOffset;
    const cx = graphOffsetX + PAD_X + lane * LANE_W;
    const cy = PAD_Y + row * ROW_H;

    // ── Lines to each parent ────────────────────────────────────────────────
    const parentLimit = commit.isStash ? 1 : commit.parents.length;
    for (let pi = 0; pi < parentLimit; pi++) {
      const ph = commit.parents[pi];
      const pRow = commitRow.get(ph);
      const pLane = commitLane.get(ph);
      const lineColor = pi === 0 ? col(lane) : col(pLane ?? lane);

      const path = ns("path");
      path.setAttribute("fill", "none");
      path.style.stroke = commit.isStash ? "#666" : lineColor;
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      if (commit.isStash) path.setAttribute("stroke-dasharray", "4 3");

      if (pRow === undefined) {
        // Parent outside window: short downward stub
        path.setAttribute("d", `M ${cx} ${cy + DOT_R} L ${cx} ${cy + ROW_H * 0.7}`);
      } else {
        const px = graphOffsetX + PAD_X + (pLane ?? lane) * LANE_W;
        const py = PAD_Y + (pRow + rowOffset) * ROW_H;
        if (lane === (pLane ?? lane)) {
          path.setAttribute("d", `M ${cx} ${cy + DOT_R} L ${px} ${py - DOT_R}`);
        } else {
          // Different lane: dogleg with rounded corners — late bend keeps
          // the line in its own lane until just above the parent's dot
          const elbowY = py - ROW_H * 0.5;
          const r = 4;
          const rx = px > cx ? r : -r;
          path.setAttribute(
            "d",
            `M ${cx} ${cy + DOT_R}` +
              ` L ${cx} ${elbowY - r}` +
              ` Q ${cx} ${elbowY} ${cx + rx} ${elbowY}` +
              ` L ${px - rx} ${elbowY}` +
              ` Q ${px} ${elbowY} ${px} ${elbowY + r}` +
              ` L ${px} ${py - DOT_R}`,
          );
        }
      }
      lineG.appendChild(path);
    }

    // ── Row highlight + hit target ───────────────────────────────────────────
    if (selectedHash === commit.hash) {
      const bg = ns("rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", String(cy - ROW_H / 2));
      bg.setAttribute("width", "10000");
      bg.setAttribute("height", String(ROW_H));
      bg.setAttribute("fill", "var(--highlight-color-ct2)");
      highlightG.appendChild(bg);
    }
    const hit = ns("rect");
    hit.setAttribute("x", "0");
    hit.setAttribute("y", String(cy - ROW_H / 2));
    hit.setAttribute("width", "10000");
    hit.setAttribute("height", String(ROW_H));
    hit.setAttribute("fill", "none");
    hit.setAttribute("pointer-events", "all");
    hit.setAttribute("data-hash", commit.hash);
    hit.style.cursor = "pointer";
    hitG.appendChild(hit);

    // ── Commit dot ──────────────────────────────────────────────────────────
    if (commit.isStash) {
      const r = DOT_R + 1;
      const diamond = ns("polygon");
      diamond.setAttribute("points", `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`);
      diamond.setAttribute("fill", "none");
      diamond.setAttribute("stroke", "#888");
      diamond.setAttribute("stroke-width", "1.5");
      commitG.appendChild(diamond);
    } else {
      const clipId = `av-${commit.hash.slice(0, 8)}`;
      const clip = ns("clipPath");
      clip.id = clipId;
      const clipCircle = ns("circle");
      clipCircle.setAttribute("cx", String(cx));
      clipCircle.setAttribute("cy", String(cy));
      clipCircle.setAttribute("r", String(DOT_R));
      clip.appendChild(clipCircle);
      defs.appendChild(clip);

      const img = ns("image");
      img.setAttribute("href", authorAvatarUrl(commit.author));
      img.setAttribute("x", String(cx - DOT_R));
      img.setAttribute("y", String(cy - DOT_R));
      img.setAttribute("width", String(DOT_R * 2));
      img.setAttribute("height", String(DOT_R * 2));
      img.setAttribute("clip-path", `url(#${clipId})`);
      commitG.appendChild(img);

      const ring = ns("circle");
      ring.setAttribute("cx", String(cx));
      ring.setAttribute("cy", String(cy));
      ring.setAttribute("r", String(DOT_R));
      ring.setAttribute("fill", "none");
      ring.style.stroke = col(lane);
      ring.setAttribute("stroke-width", "2");
      commitG.appendChild(ring);
    }

    // ── Ref labels (left column, right-aligned, clipped to column width) ──────
    const refs = getCommitRefs(commit);
    if (refs.length > 0) {
      const rowW = refRowWidth(refs, commit.isHEAD);
      const rightEdge = graphOffsetX - TEXT_GAP;
      let rx = Math.max(2, rightEdge - rowW);

      const refsG = ns("g");
      refsG.setAttribute("clip-path", "url(#gc-ref-col)");
      commitG.appendChild(refsG);

      for (const ref of refs) {
        const { name, fullName, kind } = ref;
        const isCurrent = commit.isHEAD && kind === "local";
        const displayName = isCurrent ? `✓ ${name}` : name;
        const w = displayName.length * 6.5 + 10;
        const fill = kind === "tag" ? "#3d6e1a" : kind === "remote" ? "#5a3d7a" : kind === "stash" ? "#7a5500" : "#1d4d8a";

        const badgeG = ns("g");

        const titleEl = ns("title");
        titleEl.textContent = fullName; // tooltip shows e.g. "origin/main"
        badgeG.appendChild(titleEl);

        const bg = ns("rect");
        bg.setAttribute("x", String(rx));
        bg.setAttribute("y", String(cy - 8));
        bg.setAttribute("width", String(w));
        bg.setAttribute("height", "16");
        bg.setAttribute("rx", "3");
        bg.setAttribute("fill", fill);
        bg.setAttribute("opacity", "0.8");
        badgeG.appendChild(bg);

        const lt = ns("text");
        lt.setAttribute("x", String(rx + 5));
        lt.setAttribute("y", String(cy));
        lt.setAttribute("fill", "#d0e8ff");
        lt.setAttribute("font-size", "10");
        lt.textContent = displayName;
        badgeG.appendChild(lt);

        refsG.appendChild(badgeG);
        rx += w + 4;
      }
    }

    // ── Commit subject (right of graph) ─────────────────────────────────────
    const text = ns("text");
    text.setAttribute("x", String(textX));
    text.setAttribute("y", String(cy));
    if (commit.isStash) {
      text.setAttribute("fill", "#888");
      text.setAttribute("font-style", "italic");
    }
    const subject = commit.subject;
    text.textContent = subject.length > 72 ? `${subject.slice(0, 72)}…` : subject;
    commitG.appendChild(text);
  }

  return svg;
}

// ── Lane assignment ──────────────────────────────────────────────────────────

function computeLayout(commits: GitCommitNode[]): {
  commitLane: Map<string, number>;
  commitRow: Map<string, number>;
  maxLane: number;
} {
  const commitRow = new Map<string, number>();
  const commitLane = new Map<string, number>();
  commits.forEach((c, i) => {
    commitRow.set(c.hash, i);
  });

  const lanes: Array<string | null> = [];

  for (const commit of commits) {
    if (commit.isStash) continue;

    let lane = lanes.indexOf(commit.hash);

    if (lane === -1) {
      lane = lanes.indexOf(null);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(null);
      }
    }

    commitLane.set(commit.hash, lane);
    lanes[lane] = commit.parents[0] ?? null;

    for (let i = 0; i < lanes.length; i++) {
      if (i !== lane && lanes[i] === commit.hash) lanes[i] = null;
    }

    for (let pi = 1; pi < commit.parents.length; pi++) {
      const ph = commit.parents[pi];
      if (lanes.includes(ph)) continue;
      let fl = lanes.indexOf(null);
      if (fl === -1) {
        fl = lanes.length;
        lanes.push(null);
      }
      lanes[fl] = ph;
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
  }

  const maxRegularLane = commitLane.size > 0 ? Math.max(...commitLane.values()) : 0;
  const stashLane = maxRegularLane + 1;
  for (const commit of commits) {
    if (commit.isStash) commitLane.set(commit.hash, stashLane);
  }

  const maxLane = commitLane.size > 0 ? Math.max(...commitLane.values()) : 0;
  return { commitLane, commitRow, maxLane };
}
