import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  Inject,
  input,
  signal,
} from "@angular/core";
import { BusyIndicatorRegistration } from "./busy-indicator.service";
import { BusyIndicatorService } from "./busy-indicator.service";
import { TabId } from "@cogno/core-api";
import { TerminalId } from "../../grid-list/+model/model";

const FRAME_INTERVAL_MS = 150;
const MAX_HEIGHT = 4;
const MIN_HEIGHT = 1;
const BAR_COUNT = 5;
const BLOCK_INDICES = Array.from({ length: MAX_HEIGHT }, (_, i) => i);
const LERP_FACTOR = 0.3;
const CONVERGE_THRESHOLD = 0.05;

@Component({
  selector: "app-busy-indicator",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (h of barHeights(); track $index) {
      <div class="col">
        @for (b of blockIndices; track b) {
          <div class="block" [style.opacity]="blockOpacity(h, b)"></div>
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
    }
  `,
})
export class BusyIndicatorComponent {
  targetId = input.required<TerminalId | TabId>();
  targetKind = input.required<"terminal" | "tab">();
  pauseInBackground = input(false);

  readonly blockIndices = BLOCK_INDICES;

  private currentHeights: number[] = Array(BAR_COUNT).fill(MIN_HEIGHT);
  private activeKeyframes: number[][] = [];
  private currentKeyframeIndex = 0;
  private animationInterval: ReturnType<typeof setInterval> | undefined;
  private isPausedForBackground = false;
  private visibilityHandler: (() => void) | undefined;

  private readonly _barHeights = signal<number[]>(this.currentHeights.slice());
  protected readonly barHeights = this._barHeights.asReadonly();

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

  blockOpacity(colHeight: number, blockIndex: number): number {
    return Math.max(0, Math.min(1, colHeight - blockIndex));
  }

  private onRegistrationsChanged(regs: BusyIndicatorRegistration[]): void {
    if (regs.length === 0) {
      this.activeKeyframes = [Array(BAR_COUNT).fill(MIN_HEIGHT)];
      this.currentKeyframeIndex = 0;
    } else {
      const top = regs.reduce((a, b) => (b.priority > a.priority ? b : a));
      this.activeKeyframes = top.keyframes;
      this.currentKeyframeIndex = 0;
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

    let allConverged = true;
    for (let i = 0; i < BAR_COUNT; i++) {
      const delta = target[i] - this.currentHeights[i];
      if (Math.abs(delta) > CONVERGE_THRESHOLD) {
        this.currentHeights[i] += delta * LERP_FACTOR;
        allConverged = false;
      } else {
        this.currentHeights[i] = target[i];
      }
    }
    this._barHeights.set(this.currentHeights.slice());

    if (allConverged) {
      if (this.activeKeyframes.length > 1) {
        this.currentKeyframeIndex = (this.currentKeyframeIndex + 1) % this.activeKeyframes.length;
      } else if (target.every((h) => h <= MIN_HEIGHT)) {
        this.stopInterval();
      }
    }
  }
}
