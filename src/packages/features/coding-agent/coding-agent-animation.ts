import { AnimationSpec } from "@cogno/core-api";
import { BAR_COUNT, heightFrameToGrid, MAX_HEIGHT, MIN_HEIGHT } from "@cogno/core-ui";

export const AGENT_STATUS_REGISTRATION_KEY = "coding-agent-status";

function makeSyncPulseKeyframes(): number[][][] {
  return Array.from({ length: 4 }, (_, fi) => {
    const t = (fi / 4) * Math.PI * 2;
    const h = MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 + 0.5 * Math.sin(t));
    return heightFrameToGrid(Array(BAR_COUNT).fill(h));
  });
}

// A 3-wide block that gently floats up and down — possible only with the grid format.
const FLOATING_IDLE_KEYFRAMES: number[][][] = [
  [[0,0,0,0,0], [0,0,0,0,0], [0,1,1,1,0], [0,1,1,1,0]], // bottom
  [[0,0,0,0,0], [0,1,1,1,0], [0,1,1,1,0], [0,0,0,0,0]], // center
  [[0,1,1,1,0], [0,1,1,1,0], [0,0,0,0,0], [0,0,0,0,0]], // top
  [[0,0,0,0,0], [0,1,1,1,0], [0,1,1,1,0], [0,0,0,0,0]], // center
];

const FLOATING_CLOUD_KEYFRAMES = [
  heightFrameToGrid([2, 3, 3, 3, 2]),
  heightFrameToGrid([2, 3, 4, 3, 2]),
  heightFrameToGrid([1, 3, 4, 3, 1]),
  heightFrameToGrid([2, 4, 3, 4, 2]),
  heightFrameToGrid([2, 3, 4, 3, 2]),
  heightFrameToGrid([1, 3, 3, 3, 1]),
];

export const AGENT_STATUS_SPECS = {
  ready:    { keyframes: FLOATING_IDLE_KEYFRAMES, priority: 25 },
  working:  { keyframes: FLOATING_CLOUD_KEYFRAMES, priority: 50 },
  question: { keyframes: makeSyncPulseKeyframes(), priority: 75 },
  error: {
    keyframes: [
      heightFrameToGrid([4, 1, 4, 1, 4]),
      heightFrameToGrid([3, 2, 3, 2, 3]),
      heightFrameToGrid([1, 4, 1, 4, 1]),
      heightFrameToGrid([2, 3, 2, 3, 2]),
    ],
    priority: 100,
  },
} satisfies Record<string, AnimationSpec>;
