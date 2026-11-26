/**
 * Where an arrow key lands in a list: the row before or after the current
 * one, or the first row while none is current (`from` -1). Nothing at the
 * ends: the keyboard does not wrap around.
 */
export function nextStop<T>(items: ReadonlyArray<T>, from: number, step: 1 | -1): T | undefined {
  return items[from < 0 ? 0 : from + step];
}
