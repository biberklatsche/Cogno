import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  Inject,
  input,
  OnDestroy,
  signal,
} from "@angular/core";
import { BAR_COUNT, MAX_HEIGHT } from "./busy-indicator.constants";

const FRAME_INTERVAL_MS = 50;
const KEYFRAME_DURATION_MS = 300;
const LERP_FACTOR = 0.18;
const IDLE_CONVERGE_THRESHOLD = 0.04;

// Column indices for template iteration (left → right).
const COL_INDICES = Array.from({ length: BAR_COUNT }, (_, i) => i);
// Row indices iterated bottom-first: column uses flex-direction:column-reverse,
// so the first DOM child renders at the bottom.
const ROW_INDICES_FROM_BOTTOM = Array.from({ length: MAX_HEIGHT }, (_, i) => MAX_HEIGHT - 1 - i);

const IDLE_GRID: number[][] = Array.from({ length: MAX_HEIGHT }, () => Array(BAR_COUNT).fill(0));

function makeIdleGrid(): number[][] {
  return IDLE_GRID.map((row) => [...row]);
}

/**
 * The small bar grid of the busy indicators: plays the given keyframes in a
 * loop, fading between them, and fades out to empty when there are none.
 * Each keyframe is a MAX_HEIGHT×BAR_COUNT grid, row 0 on top, values 0 to 1.
 */
@Component({
  selector: "app-keyframe-bars",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (col of colIndices; track col) {
      <div class="col">
        @for (row of rowIndicesFromBottom; track row) {
          <div class="block" [style.opacity]="grid()[row][col]"></div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: flex-end;
      flex-shrink: 0;
    }
    .col {
      display: flex;
      flex-direction: column-reverse;
      width: 2px;
      flex-shrink: 0;
    }
    .block {
      width: 2px;
      height: 2px;
      flex-shrink: 0;
      background: currentColor;
    }
  `,
})
export class KeyframeBarsComponent implements OnDestroy {
  /** The frames to play; none fades the bars out. */
  keyframes = input<ReadonlyArray<number[][]> | undefined>(undefined);
  /** Stops animating while the window is hidden. */
  pauseInBackground = input(false);

  protected readonly colIndices = COL_INDICES;
  protected readonly rowIndicesFromBottom = ROW_INDICES_FROM_BOTTOM;

  private currentGrid: number[][] = makeIdleGrid();
  private activeKeyframes: ReadonlyArray<number[][]> = [];
  private currentKeyframeIndex = 0;
  private keyframeElapsed = 0;
  private isIdle = true;
  private animationInterval: ReturnType<typeof setInterval> | undefined;
  private isPausedForBackground = false;

  private readonly _grid = signal<number[][]>(makeIdleGrid());
  protected readonly grid = this._grid.asReadonly();

  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    effect(() => this.play(this.keyframes()));

    effect((onCleanup) => {
      if (!this.pauseInBackground()) return;
      const onVisibilityChange = () => {
        if (this.doc.hidden) {
          this.stopInterval();
          this.isPausedForBackground = true;
        } else {
          this.isPausedForBackground = false;
          if (!this.animationInterval && this.activeKeyframes.length > 0) {
            this.startInterval();
          }
        }
      };
      this.doc.addEventListener("visibilitychange", onVisibilityChange);
      onCleanup(() => {
        this.doc.removeEventListener("visibilitychange", onVisibilityChange);
        this.isPausedForBackground = false;
      });
    });
  }

  ngOnDestroy(): void {
    this.stopInterval();
  }

  private play(keyframes: ReadonlyArray<number[][]> | undefined): void {
    if (!keyframes || keyframes.length === 0) {
      if (this.isIdle) return;
      this.activeKeyframes = [IDLE_GRID];
      this.isIdle = true;
    } else {
      this.activeKeyframes = keyframes;
      this.isIdle = false;
    }
    this.currentKeyframeIndex = 0;
    this.keyframeElapsed = 0;

    if (!this.animationInterval && !this.isPausedForBackground) {
      this.startInterval();
    }
  }

  private startInterval(): void {
    this.animationInterval = setInterval(() => this.tick(), FRAME_INTERVAL_MS);
  }

  private stopInterval(): void {
    clearInterval(this.animationInterval);
    this.animationInterval = undefined;
  }

  private tick(): void {
    const target = this.activeKeyframes[this.currentKeyframeIndex];
    if (!target) return;

    for (let row = 0; row < MAX_HEIGHT; row++) {
      for (let col = 0; col < BAR_COUNT; col++) {
        this.currentGrid[row][col] += (target[row][col] - this.currentGrid[row][col]) * LERP_FACTOR;
      }
    }
    this._grid.set(this.currentGrid.map((row) => [...row]));

    if (!this.isIdle) {
      this.keyframeElapsed += FRAME_INTERVAL_MS;
      if (this.keyframeElapsed >= KEYFRAME_DURATION_MS && this.activeKeyframes.length > 1) {
        this.currentKeyframeIndex = (this.currentKeyframeIndex + 1) % this.activeKeyframes.length;
        this.keyframeElapsed = 0;
      }
    } else if (
      this.currentGrid.every((row) => row.every((v) => Math.abs(v) < IDLE_CONVERGE_THRESHOLD))
    ) {
      this.currentGrid = makeIdleGrid();
      this._grid.set(makeIdleGrid());
      this.stopInterval();
    }
  }
}
