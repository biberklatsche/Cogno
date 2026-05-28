import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, Inject, input, signal } from "@angular/core";
import { merge } from "rxjs";
import { TerminalId } from "../../grid-list/+model/model";
import { TerminalActivityService } from "../terminal-activity/terminal-activity.service";

const FRAME_INTERVAL_MS = 150;
const IDLE_TIMEOUT_MS = 500;
const MAX_HEIGHT = 4;
const MIN_HEIGHT = 1;
const BAR_COUNT = 5;
const BLOCK_INDICES = Array.from({ length: MAX_HEIGHT }, (_, i) => i);
const RANDOM_FLIP_CHANCE = 0.2;

@Component({
  selector: "app-busy-indicator",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (h of barHeights(); track $index) {
      <div class="col">
        @for (b of blockIndices; track b) {
          <div class="block" [class.active]="b < h"></div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      gap: 1px;
    }
    .col {
      display: flex;
      flex-direction: column-reverse;
      gap: 1px;
    }
    .block {
      width: 2px;
      height: 2px;
      background: currentColor;
      opacity: 0;
    }
    .block.active {
      opacity: 1;
    }
  `,
})
export class BusyIndicatorComponent {
  terminalIds = input.required<TerminalId[]>();
  pauseInBackground = input(false);
  readonly blockIndices = BLOCK_INDICES;
  private heights = [2, 4, 1, 3, 2];
  private directions = [1, -1, 1, -1, 1];
  private readonly _barHeights = signal(this.heights);
  protected readonly barHeights = this._barHeights.asReadonly();
  private lastActivityTime = 0;
  private isSettling = false;
  private animationInterval: ReturnType<typeof setInterval> | undefined;
  private isPausedForBackground = false;
  private visibilityHandler: (() => void) | undefined;

  constructor(
    private readonly activity: TerminalActivityService,
    @Inject(DOCUMENT) private readonly doc: Document,
  ) {
    effect((onCleanup) => {
      const ids = this.terminalIds();
      const pauseWhenHidden = this.pauseInBackground();
      if (ids.length === 0) return;

      const sub = merge(...ids.map((id) => this.activity.activity$(id))).subscribe(() => {
        this.lastActivityTime = Date.now();
        this.isSettling = false;
        if (!this.animationInterval && !this.isPausedForBackground) {
          this.startAnimation();
        }
      });

      if (pauseWhenHidden) {
        this.visibilityHandler = () => {
          if (this.doc.hidden) {
            this.stopAnimation();
            this.isPausedForBackground = true;
          } else {
            this.isPausedForBackground = false;
            if (!this.animationInterval) {
              const timeSinceActivity = Date.now() - this.lastActivityTime;
              if (timeSinceActivity < IDLE_TIMEOUT_MS || this.heights.some((h) => h > MIN_HEIGHT)) {
                this.startAnimation();
              }
            }
          }
        };
        this.doc.addEventListener("visibilitychange", this.visibilityHandler);
      }

      onCleanup(() => {
        sub.unsubscribe();
        this.stopAnimation();
        if (this.visibilityHandler) {
          this.doc.removeEventListener("visibilitychange", this.visibilityHandler);
          this.visibilityHandler = undefined;
        }
        this.isPausedForBackground = false;
      });
    });
  }

  private startAnimation(): void {
    this.animationInterval = setInterval(() => {
      if (!this.isSettling && Date.now() - this.lastActivityTime > IDLE_TIMEOUT_MS) {
        this.isSettling = true;
      }
      this.isSettling ? this.settle() : this.advance();
    }, FRAME_INTERVAL_MS);
  }

  private stopAnimation(): void {
    clearInterval(this.animationInterval);
    this.animationInterval = undefined;
    this.isSettling = false;
  }

  private settle(): void {
    const next = [...this.heights];
    for (let i = 0; i < BAR_COUNT; i++) {
      if (next[i] > MIN_HEIGHT) next[i]--;
    }
    this.heights = next;
    this._barHeights.set(next);
    if (next.every((h) => h <= MIN_HEIGHT)) {
      this.stopAnimation();
    }
  }

  private advance(): void {
    const next = [...this.heights];
    for (let i = 0; i < BAR_COUNT; i++) {
      const candidate = this.heights[i] + this.directions[i];
      if (candidate >= MAX_HEIGHT) {
        next[i] = MAX_HEIGHT;
        this.directions[i] = -1;
      } else if (candidate <= MIN_HEIGHT) {
        next[i] = MIN_HEIGHT;
        this.directions[i] = 1;
      } else {
        next[i] = candidate;
        if (Math.random() < RANDOM_FLIP_CHANCE) {
          this.directions[i] = -this.directions[i];
        }
      }
    }
    this.heights = next;
    this._barHeights.set(next);
  }
}
