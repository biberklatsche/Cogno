import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, Inject, input, signal } from "@angular/core";
import { TabId, TerminalId } from "@cogno/core-api";
import { BAR_COUNT, MAX_HEIGHT } from "@cogno/core-ui";
import { BusyIndicatorRegistration, BusyIndicatorService } from "./busy-indicator.service";

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

@Component({
  selector: "app-busy-indicator",
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
export class BusyIndicatorComponent {
  targetId = input.required<TerminalId | TabId>();
  targetKind = input.required<"terminal" | "tab">();
  pauseInBackground = input(false);

  readonly colIndices = COL_INDICES;
  readonly rowIndicesFromBottom = ROW_INDICES_FROM_BOTTOM;

  private currentGrid: number[][] = makeIdleGrid();
  private activeKeyframes: number[][][] = [];
  private currentKeyframeIndex = 0;
  private keyframeElapsed = 0;
  private activeRegistrationId: string | undefined;
  private isIdle = true;
  private animationInterval: ReturnType<typeof setInterval> | undefined;
  private isPausedForBackground = false;
  private visibilityHandler: (() => void) | undefined;

  private readonly _grid = signal<number[][]>(makeIdleGrid());
  protected readonly grid = this._grid.asReadonly();

  constructor(
    private readonly busyIndicatorService: BusyIndicatorService,
    @Inject(DOCUMENT) private readonly doc: Document,
  ) {
    effect((onCleanup) => {
      const id = this.targetId();
      const kind = this.targetKind();
      const pauseWhenHidden = this.pauseInBackground();

      const registrations$ =
        kind === "terminal"
          ? this.busyIndicatorService.forTerminal$(id)
          : this.busyIndicatorService.forTab$(id);

      const sub = registrations$.subscribe((regs) => {
        this.onRegistrationsChanged(regs);
      });

      if (pauseWhenHidden) {
        this.visibilityHandler = () => {
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
        this.doc.addEventListener("visibilitychange", this.visibilityHandler);
      }

      onCleanup(() => {
        sub.unsubscribe();
        this.stopInterval();
        if (this.visibilityHandler) {
          this.doc.removeEventListener("visibilitychange", this.visibilityHandler);
          this.visibilityHandler = undefined;
        }
        this.isPausedForBackground = false;
      });
    });
  }

  private onRegistrationsChanged(regs: BusyIndicatorRegistration[]): void {
    if (regs.length === 0) {
      if (!this.isIdle) {
        this.activeKeyframes = [IDLE_GRID];
        this.currentKeyframeIndex = 0;
        this.keyframeElapsed = 0;
        this.activeRegistrationId = undefined;
        this.isIdle = true;
      }
    } else {
      const top = regs.reduce((a, b) => (b.priority > a.priority ? b : a));
      if (
        top.registrationId !== this.activeRegistrationId ||
        top.keyframes !== this.activeKeyframes
      ) {
        this.activeKeyframes = top.keyframes;
        this.currentKeyframeIndex = 0;
        this.keyframeElapsed = 0;
        this.activeRegistrationId = top.registrationId;
        this.isIdle = false;
      }
    }

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
    } else {
      if (
        this.currentGrid.every((row) => row.every((v) => Math.abs(v) < IDLE_CONVERGE_THRESHOLD))
      ) {
        this.currentGrid = makeIdleGrid();
        this._grid.set(makeIdleGrid());
        this.stopInterval();
      }
    }
  }
}
