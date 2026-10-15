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
 */
export function layoutGraph(commits: ReadonlyArray<GraphCommit>): GraphRow[] {
  const lanes: (string | null)[] = [];
  const laneColors: number[] = [];
  let nextColor = 0;
  const rows: GraphRow[] = [];

  const freeLane = (): number => {
    const index = lanes.indexOf(null);
    return index === -1 ? lanes.length : index;
  };

  for (const commit of commits) {
    const segments: GraphSegment[] = [];
    let lane = lanes.indexOf(commit.sha);
    const isBranchTip = lane === -1;
    if (isBranchTip) {
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
    const fromNode = new Set<number>();

    // Bottom half: the node hands its lane to the first parent and opens lanes for the rest.
    const [firstParent, ...otherParents] = commit.parents;
    if (firstParent === undefined) {
      lanes[lane] = null;
    } else {
      // Even when another lane already waits for the first parent, the line
      // stays straight; both lanes meet in the parent's node.
      lanes[lane] = firstParent;
      fromNode.add(lane);
      segments.push({ half: "bottom", from: lane, to: lane, color });
    }
    for (const parent of otherParents) {
      let target = lanes.indexOf(parent);
      if (target === -1) {
        target = freeLane();
        lanes[target] = parent;
        laneColors[target] = nextColor++;
      }
      fromNode.add(target);
      segments.push({ half: "bottom", from: lane, to: target, color: laneColors[target] ?? 0 });
    }

    // Lanes that only pass by continue straight down.
    for (let index = 0; index < lanes.length; index++) {
      if (lanes[index] === null || fromNode.has(index) || index === lane) continue;
      segments.push({ half: "bottom", from: index, to: index, color: laneColors[index] ?? 0 });
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();

    let width = lane + 1;
    for (const segment of segments) width = Math.max(width, segment.from + 1, segment.to + 1);
    rows.push({ lane, color, segments, width });
  }

  return rows;
}
