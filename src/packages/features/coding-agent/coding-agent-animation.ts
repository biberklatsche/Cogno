import { AnimationSpec } from "@cogno/core-api";
import { BAR_COUNT, MAX_HEIGHT, MIN_HEIGHT } from "@cogno/core-ui";

export const AGENT_STATUS_REGISTRATION_KEY = "coding-agent-status";

export const AGENT_STATUS_PRIORITY = {
  error: 100,
  question: 75,
  working: 50,
  ready: 0,
} as const;

function makeSyncPulseKeyframes(): number[][] {
  return Array.from({ length: 4 }, (_, fi) =>
    Array.from({ length: BAR_COUNT }, () => {
      const t = (fi / 4) * Math.PI * 2;
      return Math.round(MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (0.5 + 0.5 * Math.sin(t)));
    }),
  );
}

const FLOATING_CLOUD_KEYFRAMES = [
  [2, 3, 3, 3, 2],
  [2, 3, 4, 3, 2],
  [1, 3, 4, 3, 1],
  [2, 4, 3, 4, 2],
  [2, 3, 4, 3, 2],
  [1, 3, 3, 3, 1],
] satisfies number[][];

export const AGENT_STATUS_SPECS = {
  working: {
    keyframes: FLOATING_CLOUD_KEYFRAMES,
    priority: AGENT_STATUS_PRIORITY.working,
  },
  question: { keyframes: makeSyncPulseKeyframes(), priority: AGENT_STATUS_PRIORITY.question },
  error: {
    keyframes: [
      [4, 1, 4, 1, 4],
      [3, 2, 3, 2, 3],
      [1, 4, 1, 4, 1],
      [2, 3, 2, 3, 2],
    ],
    priority: AGENT_STATUS_PRIORITY.error,
  },
} satisfies Record<string, AnimationSpec>;
