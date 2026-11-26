/** How long a fast-moving selection must rest before git is asked about it. */
const REST_MS = 120;

/**
 * Starts the loads for a selection that may move fast, as with an arrow key
 * held down. A single change loads at once; changes in quick succession wait
 * until the selection rests, so git is not started for every row passed.
 */
export class PacedLoad {
  private lastStart = 0;
  private waiting: ReturnType<typeof setTimeout> | null = null;

  /** Takes the place of a load still waiting. */
  start(load: () => void): void {
    this.cancel();
    const now = Date.now();
    const moving = now - this.lastStart < REST_MS;
    this.lastStart = now;
    if (!moving) {
      load();
      return;
    }
    this.waiting = setTimeout(() => {
      this.waiting = null;
      load();
    }, REST_MS);
  }

  cancel(): void {
    if (this.waiting !== null) clearTimeout(this.waiting);
    this.waiting = null;
  }
}
