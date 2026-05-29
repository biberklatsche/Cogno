import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, Inject, input, signal } from "@angular/core";
import { TabId } from "@cogno/core-api";
import { TerminalId } from "../../grid-list/+model/model";
import { BAR_COUNT, MAX_HEIGHT, MIN_HEIGHT } from "./busy-indicator.constants";
import { BusyIndicatorRegistration, BusyIndicatorService } from "./busy-indicator.service";

const FRAME_INTERVAL_MS = 50;
const KEYFRAME_DURATION_MS = 300;
const BLOCK_INDICES = Array.from({ length: MAX_HEIGHT }, (_, i) => i);
const LERP_FACTOR = 0.18;
const IDLE_CONVERGE_THRESHOLD = 0.04;

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
  private keyframeElapsed = 0;
  private activeRegistrationId: string | undefined;
  private isIdle = true;
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

  protected blockOpacity(colHeight: number, blockIndex: number): number {
    return Math.max(0, Math.min(1, colHeight - blockIndex));
  }

  private onRegistrationsChanged(regs: BusyIndicatorRegistration[]): void {
    if (regs.length === 0) {
      if (!this.isIdle) {
        this.activeKeyframes = [Array(BAR_COUNT).fill(MIN_HEIGHT)];
        this.currentKeyframeIndex = 0;
        this.keyframeElapsed = 0;
        this.activeRegistrationId = undefined;
        this.isIdle = true;
      }
    } else {
      const top = regs.reduce((a, b) => (b.priority > a.priority ? b : a));
      if (top.registrationId !== this.activeRegistrationId) {
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

    for (let i = 0; i < BAR_COUNT; i++) {
      this.currentHeights[i] += (target[i] - this.currentHeights[i]) * LERP_FACTOR;
    }
    this._barHeights.set(this.currentHeights.slice());

    if (!this.isIdle) {
      this.keyframeElapsed += FRAME_INTERVAL_MS;
      if (this.keyframeElapsed >= KEYFRAME_DURATION_MS && this.activeKeyframes.length > 1) {
        this.currentKeyframeIndex = (this.currentKeyframeIndex + 1) % this.activeKeyframes.length;
        this.keyframeElapsed = 0;
      }
    } else {
      if (this.currentHeights.every((h) => Math.abs(h - MIN_HEIGHT) < IDLE_CONVERGE_THRESHOLD)) {
        this.currentHeights.fill(MIN_HEIGHT);
        this._barHeights.set(this.currentHeights.slice());
        this.stopInterval();
      }
    }
  }
}
