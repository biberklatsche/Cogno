// The motion is ported from Ding (https://github.com/YusufCeng1z/ding), MIT,
// Copyright (c) 2026 Yusuf Cengiz. The license text is in `DING-LICENSE` next
// to this file.
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from "@angular/core";
import { NotificationTypeContract } from "@cogno/shared/domain";
import { AppNotificationToastPhase } from "./+state/app-notification-toast.models";
import { Spring, SpringConfig, springEasing } from "./toast-spring";

/** Arrival: quick, lands with a hint of overshoot. */
const ENTER_SPRING: SpringConfig = { stiffness: 320, damping: 26 };
/** The pill opening: liquid but controlled. */
const MORPH_SPRING: SpringConfig = { stiffness: 340, damping: 27 };
/** Closing is firmer and does not overshoot. */
const CLOSING_SPRING: SpringConfig = { stiffness: 380, damping: 36 };
const SHAKE_SPRING: SpringConfig = { stiffness: 520, damping: 13 };

const POP_EASING = springEasing(ENTER_SPRING);
const SWAP_EASING = springEasing({ stiffness: 400, damping: 36 });

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

let reducedMotionQuery: MediaQueryList | undefined;

function prefersReducedMotion(): boolean {
  reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionQuery.matches;
}

/**
 * Drives the toast pill. Width, height and entrance position are springs; how
 * far text and buttons are revealed is derived from the live width
 * (`--reveal`, `--action-reveal`), so box and content stay locked together.
 *
 * Expects a `.body` child that holds a `.copy` and the buttons.
 */
@Directive({
  selector: "[appToastMotion]",
  standalone: true,
})
export class ToastMotionDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) phase!: AppNotificationToastPhase;
  @Input({ required: true }) type!: NotificationTypeContract;

  // The measures of the toast are set once, in its stylesheet; they are read from there on start.
  /** Side of the closed shape. */
  private shapeSize = 0;
  /** How far below its resting place the shape starts. */
  private enterOffset = 0;
  private enterScale = 1;

  private readonly width = new Spring(0, MORPH_SPRING);
  private readonly height = new Spring(0, MORPH_SPRING);
  private readonly offsetY = new Spring(0, ENTER_SPRING);
  private readonly offsetX = new Spring(0, SHAKE_SPRING);

  private body?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private openWidth = 0;
  private openHeight = 0;
  /** Width at which the text is fully shown; the buttons are revealed beyond it. */
  private copyEnd = 0;
  private animationFrame?: number;
  private lastFrameTime = 0;
  private reactionTimer?: ReturnType<typeof setTimeout>;
  private marksReadyTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly pillElementReference: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const pill = this.pillElementReference.nativeElement;
    const body = pill.querySelector<HTMLElement>(".body");
    if (!body) {
      return;
    }
    this.body = body;
    const style = getComputedStyle(pill);
    this.shapeSize = Number.parseFloat(style.getPropertyValue("--toast-size"));
    this.enterOffset = Number.parseFloat(style.getPropertyValue("--toast-enter-offset"));
    this.enterScale = Number.parseFloat(style.getPropertyValue("--toast-enter-scale"));
    for (const side of [this.width, this.height]) {
      side.value = this.shapeSize;
      side.target = this.shapeSize;
    }
    this.offsetY.value = this.enterOffset;
    pill.style.setProperty("--toast-pop", POP_EASING.easing);
    pill.style.setProperty("--toast-pop-duration", `${POP_EASING.durationMs}ms`);
    pill.style.setProperty("--toast-swap", SWAP_EASING.easing);
    pill.style.setProperty("--toast-swap-duration", `${SWAP_EASING.durationMs}ms`);
    // After the first draw-in the ring is there: a later status change draws its marks at once.
    // Not before the first gestures have ended (the success ripple is the last, at 1.5 s):
    // the shorter delay would cut a running animation off.
    this.marksReadyTimer = setTimeout(() => pill.setAttribute("data-ready", ""), 1600);

    this.offsetY.target = 0;
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(body);
    this.measure();
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.body) {
      return;
    }
    if (changes["phase"]) {
      this.followPhase();
    } else if (changes["type"] && this.phase === "open") {
      this.react();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    clearTimeout(this.reactionTimer);
    clearTimeout(this.marksReadyTimer);
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private followPhase(): void {
    if (this.phase === "closing") {
      this.width.tune(CLOSING_SPRING);
      this.height.tune(CLOSING_SPRING);
      // A small swell before the pill collapses.
      this.width.velocity = 320;
    } else {
      this.width.tune(MORPH_SPRING);
      this.height.tune(MORPH_SPRING);
      if (this.phase === "open") {
        // Anticipation: the shape squeezes in, then springs open.
        this.width.velocity = -260;
        clearTimeout(this.reactionTimer);
        this.reactionTimer = setTimeout(() => this.react(), 200);
      }
    }
    // The exit itself is a CSS animation of the shape.
    if (this.phase !== "exit") {
      this.aim();
      this.animate();
    }
  }

  /** An error shakes its head, a warning hops. */
  private react(): void {
    if (prefersReducedMotion()) {
      return;
    }
    if (this.type === "error") {
      this.offsetX.velocity = 380;
    } else if (this.type === "warning") {
      this.offsetY.velocity = -200;
    } else {
      return;
    }
    this.animate();
  }

  private aim(): void {
    const open = this.phase === "open";
    this.width.target = open ? this.openWidth : this.shapeSize;
    this.height.target = open ? this.openHeight : this.shapeSize;
  }

  private measure(): void {
    const body = this.body;
    if (!body) {
      return;
    }
    const copy = body.querySelector<HTMLElement>(".copy");
    const buttons = Array.from(body.querySelectorAll<HTMLElement>("button"));
    // Buttons that wrapped onto their own row need room under them. The wrapped layout keeps
    // them on that row, so it is taken off before looking whether they still wrap on their own.
    body.removeAttribute("data-wrapped");
    const wrapped =
      !!copy && buttons.some((button) => button.offsetTop >= copy.offsetTop + copy.offsetHeight);
    body.toggleAttribute("data-wrapped", wrapped);

    this.openWidth = Math.ceil(this.shapeSize + body.offsetWidth);
    this.openHeight = Math.max(this.shapeSize, body.offsetHeight);
    this.copyEnd =
      copy && buttons.length > 0 && !wrapped
        ? this.shapeSize + copy.offsetWidth + 6
        : this.openWidth;
    if (this.phase === "open") {
      this.aim();
      this.animate();
    }
  }

  private animate(): void {
    if (prefersReducedMotion()) {
      for (const spring of [this.width, this.height, this.offsetY, this.offsetX]) {
        spring.settle();
      }
      this.apply();
      return;
    }
    if (this.animationFrame !== undefined) {
      return;
    }
    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame((time) => this.onFrame(time));
  }

  private onFrame(time: number): void {
    const seconds = Math.min(0.1, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;
    const moving = [
      this.width.step(seconds),
      this.height.step(seconds),
      this.offsetY.step(seconds),
      this.offsetX.step(seconds),
    ].some(Boolean);
    this.apply();

    if (moving) {
      this.animationFrame = requestAnimationFrame((nextTime) => this.onFrame(nextTime));
      return;
    }
    this.animationFrame = undefined;
    if (this.phase !== "exit") {
      // At rest there is no transform at all, so the text is never resampled at a fractional scale.
      const pill = this.pillElementReference.nativeElement;
      pill.style.translate = "none";
      pill.style.scale = "none";
    }
  }

  private apply(): void {
    const pill = this.pillElementReference.nativeElement;
    const width = this.width.value;
    const height = this.height.value;
    const reveal = clamp((width - this.shapeSize) / Math.max(1, this.copyEnd - this.shapeSize));
    const actionWidth = this.openWidth - this.copyEnd;
    // Buttons right of the text appear as the width reaches them; below it they follow the text a beat later.
    const actionReveal =
      actionWidth > 2 ? clamp((width - this.copyEnd) / actionWidth) : clamp((reveal - 0.45) / 0.55);
    // Entrance progress; overshoots slightly past 1.
    const entrance = (this.enterOffset - this.offsetY.value) / this.enterOffset;
    // Arriving stretches the shape along its travel, opening squashes it a little.
    const stretch = clamp(Math.abs(this.offsetY.velocity) / 6000, 0, 0.18);
    const squash = clamp(Math.abs(this.width.velocity) / 20000, 0, 0.05);
    const scale = this.enterScale + (1 - this.enterScale) * entrance;

    pill.style.width = `${width}px`;
    pill.style.height = `${height}px`;
    pill.style.translate = `${this.offsetX.value}px ${this.offsetY.value}px`;
    pill.style.scale = `${scale * (1 - stretch * 0.7) * (1 + squash * 0.5)} ${scale * (1 + stretch) * (1 - squash)}`;
    pill.style.opacity = String(clamp(entrance * 2));
    pill.style.setProperty("--reveal", reveal.toFixed(3));
    pill.style.setProperty("--action-reveal", actionReveal.toFixed(3));
    // Text is only crisp when nothing resamples it: once fully open, the stylesheet drops blur and nudge.
    pill.toggleAttribute("data-settled", reveal >= 1);
  }
}
