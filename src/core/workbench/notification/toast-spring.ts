// Ported from Ding (https://github.com/YusufCeng1z/ding), MIT, Copyright (c) 2026
// Yusuf Cengiz. The license text is in `DING-LICENSE` next to this file.

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
}

/**
 * A damped spring on one number. It keeps its velocity when the target moves,
 * so a retarget in mid-flight stays fluid.
 */
export class Spring {
  velocity = 0;
  target: number;

  constructor(
    public value: number,
    private config: SpringConfig,
  ) {
    this.target = value;
  }

  tune(config: SpringConfig): void {
    this.config = config;
  }

  /** Jumps to the target; used when motion is reduced. */
  settle(): void {
    this.value = this.target;
    this.velocity = 0;
  }

  /** Advances by `seconds`. Returns true while the spring is still moving. */
  step(seconds: number): boolean {
    const { stiffness, damping } = this.config;
    const stepSeconds = 1 / 240;
    for (let elapsed = 0; elapsed < seconds; elapsed += stepSeconds) {
      this.velocity +=
        (-stiffness * (this.value - this.target) - damping * this.velocity) * stepSeconds;
      this.value += this.velocity * stepSeconds;
    }
    if (Math.abs(this.velocity) < 0.05 && Math.abs(this.value - this.target) < 0.05) {
      this.settle();
      return false;
    }
    return true;
  }
}

/** Position of a damped spring going from 0 to 1 with no initial velocity. */
function springPosition(seconds: number, { stiffness, damping }: SpringConfig): number {
  const frequency = Math.sqrt(stiffness);
  const dampingRatio = damping / (2 * frequency);
  if (dampingRatio < 1) {
    const dampedFrequency = frequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    return (
      1 -
      Math.exp(-dampingRatio * frequency * seconds) *
        (Math.cos(dampedFrequency * seconds) +
          ((dampingRatio * frequency) / dampedFrequency) * Math.sin(dampedFrequency * seconds))
    );
  }
  if (dampingRatio === 1) {
    return 1 - Math.exp(-frequency * seconds) * (1 + frequency * seconds);
  }
  const spread = frequency * Math.sqrt(dampingRatio * dampingRatio - 1);
  const slowRoot = -dampingRatio * frequency + spread;
  const fastRoot = -dampingRatio * frequency - spread;
  return (
    1 -
    (fastRoot * Math.exp(slowRoot * seconds) - slowRoot * Math.exp(fastRoot * seconds)) /
      (fastRoot - slowRoot)
  );
}

/**
 * Bakes a spring into a CSS `linear()` easing, so plain CSS animations can
 * overshoot like the scripted springs do.
 */
export function springEasing(config: SpringConfig): { easing: string; durationMs: number } {
  const sampleSeconds = 1 / 120;
  // The spring has settled once it stays within 0.1 % of its rest position.
  let settleSeconds = 0;
  for (let seconds = 0; seconds <= 5; seconds += sampleSeconds) {
    if (Math.abs(1 - springPosition(seconds, config)) > 0.001) {
      settleSeconds = seconds;
    }
  }
  settleSeconds = Math.max(settleSeconds + sampleSeconds, 0.05);

  const stepCount = Math.max(2, Math.ceil(settleSeconds * 60));
  const points: string[] = [];
  for (let step = 0; step < stepCount; step++) {
    points.push(String(+springPosition((step / stepCount) * settleSeconds, config).toFixed(4)));
  }
  points.push("1");
  return { easing: `linear(${points.join(",")})`, durationMs: Math.round(settleSeconds * 1000) };
}
