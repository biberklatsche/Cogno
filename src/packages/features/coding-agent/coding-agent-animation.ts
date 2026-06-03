import { AnimationSpec } from "@cogno/core-api";

export const AGENT_STATUS_REGISTRATION_KEY = "coding-agent-status";

// Grid convention: row 0 = top, row 3 = bottom, col 0 = left, col 4 = right.
// Values: 1 = on, 0 = off. Fractional values produce partial opacity (used for dim frames).
// LERP interpolation between keyframes creates smooth transitions automatically.

// ─── ready: full ghost floating up and down ───────────────────────────────

//  .###.    head arc
//  #####    body
//  #.#.#    three-bump feet
//  .....
const GHOST_HIGH: number[][] = [
  [0,1,1,1,0],
  [1,0,1,0,1],
  [1,1,1,1,1],
  [1,0,1,0,1]
];

//  .....
//  .###.
//  #####
//  #.#.#
const GHOST_LOW: number[][] = [
  [0,0,0,0,0],
  [0,1,1,1,0],
  [1,1,1,1,1],
  [1,0,1,0,1],
];

// ─── working: small ghost sliding left → center → right ───────────────────

//  .#...    head
//  ###..    body
//  #.#..    two-bump feet
//  .....
const GHOST_LEFT: number[][] = [
  [0,1,0,0,0],
  [1,1,1,0,0],
  [1,0,1,0,0],
  [0,0,0,0,0],
];

//  ..#..
//  .###.
//  .#.#.
//  .....
const GHOST_CENTER: number[][] = [
  [0,1,1,1,0],
  [1,0,1,0,1],
  [1,1,1,1,1],
  [1,0,1,0,1]
];

//  ...#.
//  ..###
//  ..#.#
//  .....
const GHOST_RIGHT: number[][] = [
  [0,0,0,1,0],
  [0,0,1,1,1],
  [0,0,1,0,1],
  [0,0,0,0,0],
];

// ─── question: question mark pulsing ──────────────────────────────────────

//  ..##.    top of arc curving right
//  ...#.    right side down
//  ..#..    bump / stem
//  ..#..    dot
const QUESTION_MARK: number[][] = [
  [0,0,1,1,0],
  [0,0,0,1,0],
  [0,0,1,0,0],
  [0,0,1,0,0],
];

const QUESTION_DIM: number[][] = QUESTION_MARK.map((row) => row.map((v) => v * 0.15));

// ─── error: dead ghost (upside-down), flashing ────────────────────────────

//  #.#.#    feet at top — visually "fallen over"
//  #####
//  #####
//  .###.    head at bottom
const DEAD_GHOST: number[][] = [
  [1,0,1,0,1],
  [1,1,1,1,1],
  [1,1,1,1,1],
  [0,1,1,1,0],
];

const DEAD_GHOST_DIM: number[][] = DEAD_GHOST.map((row) => row.map((v) => v * 0.25));

// ─── specs ────────────────────────────────────────────────────────────────

export const AGENT_STATUS_SPECS = {
  // Two held frames each so LERP has time to reach the target before switching.
  ready:    { keyframes: [GHOST_HIGH, GHOST_HIGH, GHOST_LOW, GHOST_LOW], priority: 25 },
  working:  { keyframes: [GHOST_LEFT, GHOST_CENTER, GHOST_RIGHT, GHOST_CENTER], priority: 50 },
  question: { keyframes: [QUESTION_MARK, QUESTION_DIM], priority: 75 },
  error:    { keyframes: [DEAD_GHOST, DEAD_GHOST_DIM], priority: 100 },
} satisfies Record<string, AnimationSpec>;
