/**
 * One line segment inside a graph row. A row is split at its middle, where
 * the commit's node sits: `top` segments run from the row's top edge to the
 * middle, `bottom` segments from the middle to the bottom edge. A segment
 * starts in lane `from` and ends in lane `to`; a straight pass-through has
 * `from === to`.
 */
export type GraphSegment = {
  readonly half: "top" | "bottom";
  readonly from: number;
  readonly to: number;
  readonly color: number;
};

export type GraphRow = {
  readonly lane: number;
  readonly color: number;
  readonly segments: ReadonlyArray<GraphSegment>;
  /** Number of lanes this row draws in. */
  readonly width: number;
};

type GraphCommit = { readonly sha: string; readonly parents: ReadonlyArray<string> };

/**
 * Lays out commits (newest first, every child before its parents) in lanes.
 * Each lane waits for one commit: the parent of the commit drawn above it. A
 * commit takes the leftmost lane waiting for it - other lanes waiting for it
 * end there (branches joining) - and hands its lane on to its first parent,
 * even if another lane already waits for that parent. Further parents (a
 * merge) get a lane of their own unless one already waits for them. Freed lanes are reused from the left; lanes are never shifted, so
 * every line is either straight or a single diagonal into or out of a node.
 *
 * The checked-out commit (`headSha`, when loaded) keeps the first lane, as in
 * GitKraken: tips above it start in lane 1, and its first-parent chain runs
 * down the left edge.
 */
export function layoutGraph(
  commits: ReadonlyArray<GraphCommit>,
  headSha: string | null = null,
): GraphRow[] {
  const lanes: (string | null)[] = [];
  const laneColors: number[] = [];
  let nextColor = 0;
  const rows: GraphRow[] = [];

  let reserved = headSha && commits.some((commit) => commit.sha === headSha) ? headSha : null;
  if (reserved) {
    lanes[0] = null;
    laneColors[0] = nextColor++;
  }

  const freeLane = (): number => {
    const first = reserved ? 1 : 0;
    const index = lanes.indexOf(null, first);
    return index === -1 ? Math.max(lanes.length, first) : index;
  };

  for (const commit of commits) {
    const segments: GraphSegment[] = [];
    let lane = lanes.indexOf(commit.sha);
    let isBranchTip = lane === -1;
    if (commit.sha === reserved) {
      // Lanes waiting for it join lane 0 like at any node; the reserved lane itself has no line above.
      lane = 0;
      lanes[0] = commit.sha;
      isBranchTip = true;
      reserved = null;
    } else if (isBranchTip) {
      lane = freeLane();
      lanes[lane] = commit.sha;
      laneColors[lane] = nextColor++;
    }

    // Top half: every waiting lane comes down; those waiting for this commit end in its node.
    for (let index = 0; index < lanes.length; index++) {
      const waitingFor = lanes[index];
      if (waitingFor === null || waitingFor === undefined) continue;
      if (waitingFor === commit.sha) {
        if (index === lane && isBranchTip) continue;
        segments.push({ half: "top", from: index, to: lane, color: laneColors[index] ?? 0 });
        if (index !== lane) lanes[index] = null;
      } else {
        segments.push({ half: "top", from: index, to: index, color: laneColors[index] ?? 0 });
      }
    }

    const color = laneColors[lane] ?? 0;
    const opened = new Set<number>();

    // Bottom half: the node hands its lane to the first parent and opens lanes for the rest.
    const [firstParent, ...otherParents] = commit.parents;
    if (firstParent === undefined) {
      lanes[lane] = null;
    } else {
      // Even when another lane already waits for the first parent, the line
      // stays straight; both lanes meet in the parent's node.
      lanes[lane] = firstParent;
      segments.push({ half: "bottom", from: lane, to: lane, color });
    }
    for (const parent of otherParents) {
      let target = lanes.indexOf(parent);
      if (target === -1) {
        target = freeLane();
        lanes[target] = parent;
        laneColors[target] = nextColor++;
        opened.add(target);
      }
      segments.push({ half: "bottom", from: lane, to: target, color: laneColors[target] ?? 0 });
    }

    // Every other lane continues straight down, including one a merge line
    // just joined: the branch it waits for runs on below the node.
    for (let index = 0; index < lanes.length; index++) {
      if (lanes[index] === null || opened.has(index) || index === lane) continue;
      segments.push({ half: "bottom", from: index, to: index, color: laneColors[index] ?? 0 });
    }

    const keep = reserved ? 1 : 0;
    while (lanes.length > keep && lanes[lanes.length - 1] === null) lanes.pop();

    let width = lane + 1;
    for (const segment of segments) width = Math.max(width, segment.from + 1, segment.to + 1);
    rows.push({ lane, color, segments, width });
  }

  return rows;
}
