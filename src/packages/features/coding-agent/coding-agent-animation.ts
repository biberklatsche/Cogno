import { AnimationSpec } from "@cogno/core-api";

export const AGENT_STATUS_REGISTRATION_KEY = "coding-agent-status";

// Grid: 7 cols × 7 rows → 14×14px at 2px/block, no gap. Row 0 = top, row 6 = bottom.
// Values: 1 = on, 0 = off. Fractional values produce partial opacity.

// ─── ready: ghost standing still ──────────────────────────────────────────
//
//   .#####.
//   #######
//   #..#..#   ← eye sockets at col 1-2 and col 4-5
//   #######
//   #.#.#.#   ← wavy skirt
//   .#.#.#.
//   .......

const R = 0.3; // dim ring
const B = 1.0; // bright spot

const GHOST1: number[][] = [
  [0, 0, 0, B, 0, 0, 0],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, 0, B, 0, B, B],
  [B, B, 0, B, 0, B, B],
  [B, B, B, B, B, B, B],
  [R, B, B, B, B, B, R],
];

// ─── working: spinning circle ──────────────────────────────────────────────
//
// 7×7 circle ring. Bright spot rotates clockwise: top → right → bottom → left.
const CIRCLE_TOP: number[][] = [
  [0, 0, B, B, B, 0, 0],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, B, B, B, B, B],
  [B, B, 0, B, 0, B, B],
  [B, B, 0, B, 0, B, B],
  [R, B, B, B, B, B, R],
];

const CIRCLE_RIGHT: number[][] = [
  [0, B, R, B, R, B, 0],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, B, B, B, B, B],
  [B, B, 0, B, 0, B, B],
  [B, B, 0, B, 0, B, B],
  [R, B, B, B, B, B, R],
];

const CIRCLE_BOTTOM: number[][] = [
  [B, R, 0, B, 0, R, B],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, B, B, B, B, B],
  [B, B, 0, B, 0, B, B],
  [B, B, 0, B, 0, B, B],
  [R, B, B, B, B, B, R],
];

const CIRCLE_LEFT: number[][] = [
  [R, 0, 0, B, 0, 0, R],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, B, B, B, B, B],
  [B, B, 0, B, 0, B, B],
  [B, B, 0, B, 0, B, B],
  [R, B, B, B, B, B, R],
];

// ─── question: question mark pulsing ──────────────────────────────────────
//
//   .####.
//   .#..#.
//   ...#..
//   ..#...
//   ..#...
//   ......
//   ..##..

const QUESTION_MARK_1: number[][] = [
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 1],
  [B, B, 0, 0, 0, 1, 0],
  [B, 0, 0, 0, 0, 0, 0],
  [B, B, B, R, 0, 1, 0],
  [B, B, B, B, 0, 0, 0],
];

const QUESTION_MARK_2: number[][] = [
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 1],
  [B, R, B, 0, 0, 1, 0],
  [B, 0, 0, 0, 0, 0, 0],
  [B, B, B, R, 0, 1, 0],
  [B, B, B, B, 0, 0, 0],
];

const QUESTION_MARK_3: number[][] = [
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 1],
  [B, 0, R, B, 0, 1, 0],
  [B, 0, 0, 0, 0, 0, 0],
  [B, B, B, R, 0, 1, 0],
  [B, B, B, B, 0, 0, 0],
];

// ─── error: gravestone ────────────────────────────────────────────────────
//
//   ...#...
//   ..###..
//   ..###..
//   ..###..
//   ..###..
//   #######
//   .......

const SLEEPING: number[][] = [
  [0, 0, R, B, R, 0, 0],
  [0, 0, 0, B, 0, 0, 0],
  [R, B, B, B, B, B, R],
  [B, B, B, B, B, B, B],
  [B, R, R, B, R, R, B],
  [B, B, B, B, B, B, B],
  [R, B, B, B, B, B, R],
];

// ─── specs ────────────────────────────────────────────────────────────────

export const AGENT_STATUS_SPECS = {
  ready: { keyframes: [GHOST1], priority: 25 },
  working: { keyframes: [CIRCLE_TOP, CIRCLE_RIGHT, CIRCLE_BOTTOM, CIRCLE_LEFT], priority: 50 },
  question: { keyframes: [QUESTION_MARK_1, QUESTION_MARK_2, QUESTION_MARK_3], priority: 75 },
  error: { keyframes: [SLEEPING], priority: 100 },
} satisfies Record<string, AnimationSpec>;
