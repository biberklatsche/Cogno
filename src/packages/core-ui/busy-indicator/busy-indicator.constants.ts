export const BAR_COUNT = 5;
export const MIN_HEIGHT = 1;
export const MAX_HEIGHT = 4;

/**
 * Converts a height-based animation frame (legacy format) to the 4×5 grid format.
 * Grid convention: row 0 = top, row MAX_HEIGHT-1 = bottom; values 0 (off) or 1 (full on).
 * Fractional heights produce partial opacity values, which LERP interpolates smoothly.
 */
export function heightFrameToGrid(heights: number[]): number[][] {
  return Array.from({ length: MAX_HEIGHT }, (_, row) =>
    heights.map((h) => Math.max(0, Math.min(1, h + row - (MAX_HEIGHT - 1)))),
  );
}
