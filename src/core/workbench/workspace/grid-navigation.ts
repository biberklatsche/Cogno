export type SelectionDirection = "up" | "down" | "left" | "right";

/**
 * The tile an arrow key lands on in a row-major grid of `count` equal tiles
 * with `columns` per row, starting from `index`. Left and right stay in the
 * row and wrap inside it; a one-column grid wraps them to the neighbouring
 * rows instead. Up and down stay in the column and wrap inside it; the lone
 * tile of a short last row is reached from any column. A grid with fewer
 * than two tiles never moves.
 */
export function nextGridIndex(
  index: number,
  count: number,
  columns: number,
  direction: SelectionDirection,
): number {
  if (count < 2) return index;
  const cols = Math.max(1, columns);
  const rows = Math.ceil(count / cols);
  const row = Math.floor(index / cols);
  const col = index % cols;
  switch (direction) {
    case "right": {
      if (col < cols - 1 && index + 1 < count) return index + 1;
      // Wrap to the start of this row, or of the next row that has another tile.
      for (let k = 0; k < rows; k++) {
        const first = ((row + k) % rows) * cols;
        if (first !== index) return first;
      }
      return index;
    }
    case "left": {
      if (col > 0) return index - 1;
      // Wrap to the end of this row, or of the previous row.
      for (let k = 0; k < rows; k++) {
        const r = (row - k + rows) % rows;
        const last = Math.min(r * cols + cols - 1, count - 1);
        if (last !== index) return last;
      }
      return index;
    }
    case "down": {
      if (index + cols < count) return index + cols;
      // A short last row below: its tile is the only candidate.
      if (row + 1 < rows) return count - 1;
      // Wrap to the top of this column, else of the next column to the right.
      for (let k = 0; k < cols; k++) {
        const top = (col + k) % cols;
        if (top < count && top !== index) return top;
      }
      return index;
    }
    case "up": {
      if (row > 0) return index - cols;
      // Wrap to the bottom of this column, else of the next column to the left.
      for (let k = 0; k < cols; k++) {
        const c = (col - k + cols) % cols;
        if (c >= count) continue;
        const bottom = c + Math.floor((count - 1 - c) / cols) * cols;
        if (bottom !== index) return bottom;
      }
      return index;
    }
  }
}
