import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { AnimationSpec, TerminalAnimationPort } from "@cogno/core-api";
import { BAR_COUNT, MAX_HEIGHT } from "@cogno/core-ui";

const FRAME_INTERVAL_MS = 50;
const KEYFRAME_DURATION_MS = 300;
const LERP_FACTOR = 0.18;
const IDLE_CONVERGE_THRESHOLD = 0.04;

const COL_INDICES = Array.from({ length: BAR_COUNT }, (_, i) => i);
const ROW_INDICES_FROM_BOTTOM = Array.from({ length: MAX_HEIGHT }, (_, i) => MAX_HEIGHT - 1 - i);
const IDLE_GRID: number[][] = Array.from({ length: MAX_HEIGHT }, () => Array(BAR_COUNT).fill(0));

function makeIdleGrid(): number[][] {
  return IDLE_GRID.map((row) => [...row]);
}

@Component({
  selector: "app-agent-animation",
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
      width: 3px;
      flex-shrink: 0;
    }
    .block {
      width: 3px;
      height: 3px;
      flex-shrink: 0;
      background: currentColor;
    }
  `,
})
export class AgentAnimationComponent {
  terminalId = input.required<string>();

  protected readonly colIndices = COL_INDICES;
  protected readonly rowIndicesFromBottom = ROW_INDICES_FROM_BOTTOM;

  private currentGrid: number[][] = makeIdleGrid();
  private activeKeyframes: number[][][] = [];
  private currentKeyframeIndex = 0;
  private keyframeElapsed = 0;
  private isIdle = true;
  private animationInterval: ReturnType<typeof setInterval> | undefined;

  private readonly _grid = signal<number[][]>(makeIdleGrid());
  protected readonly grid = this._grid.asReadonly();

  private readonly animation = inject(TerminalAnimationPort);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect((onCleanup) => {
      const id = this.terminalId();
      const sub = this.animation.observe$(id).subscribe((specs) => {
        this.onSpecsChanged([...specs]);
      });
      onCleanup(() => {
        sub.unsubscribe();
        this.stopInterval();
      });
    });

    this.destroyRef.onDestroy(() => this.stopInterval());
  }

  private onSpecsChanged(specs: AnimationSpec[]): void {
    if (specs.length === 0) {
      if (!this.isIdle) {
        this.activeKeyframes = [IDLE_GRID];
        this.currentKeyframeIndex = 0;
        this.keyframeElapsed = 0;
        this.isIdle = true;
      }
    } else {
      const top = specs.reduce((a, b) => (b.priority > a.priority ? b : a));
      this.activeKeyframes = [...top.keyframes];
      this.currentKeyframeIndex = 0;
      this.keyframeElapsed = 0;
      this.isIdle = false;
    }

    if (!this.animationInterval) {
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
        this.currentGrid[row][col] +=
          (target[row][col] - this.currentGrid[row][col]) * LERP_FACTOR;
      }
    }
    this._grid.set(this.currentGrid.map((row) => [...row]));

    if (!this.isIdle) {
      this.keyframeElapsed += FRAME_INTERVAL_MS;
      if (this.keyframeElapsed >= KEYFRAME_DURATION_MS && this.activeKeyframes.length > 1) {
        this.currentKeyframeIndex = (this.currentKeyframeIndex + 1) % this.activeKeyframes.length;
        this.keyframeElapsed = 0;
      }
    } else {
      if (this.currentGrid.every((row) => row.every((v) => Math.abs(v) < IDLE_CONVERGE_THRESHOLD))) {
        this.currentGrid = makeIdleGrid();
        this._grid.set(makeIdleGrid());
        this.stopInterval();
      }
    }
  }
}
