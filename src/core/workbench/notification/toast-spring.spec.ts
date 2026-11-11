import { describe, expect, it } from "vitest";
import { Spring, springEasing } from "./toast-spring";

describe("Spring", () => {
  it("moves to its target and comes to rest there", () => {
    const spring = new Spring(0, { stiffness: 340, damping: 27 });
    spring.target = 100;

    expect(spring.step(1 / 60)).toBe(true);
    expect(spring.value).toBeGreaterThan(0);
    expect(spring.value).toBeLessThan(100);

    let moving = true;
    for (let frame = 0; frame < 600 && moving; frame++) {
      moving = spring.step(1 / 60);
    }

    expect(moving).toBe(false);
    expect(spring.value).toBe(100);
    expect(spring.velocity).toBe(0);
  });

  it("overshoots when it is underdamped", () => {
    const spring = new Spring(0, { stiffness: 520, damping: 13 });
    spring.target = 100;

    let peak = 0;
    for (let frame = 0; frame < 120; frame++) {
      spring.step(1 / 60);
      peak = Math.max(peak, spring.value);
    }

    expect(peak).toBeGreaterThan(100);
  });

  it("keeps its velocity when the target moves", () => {
    const spring = new Spring(0, { stiffness: 340, damping: 27 });
    spring.target = 100;
    spring.step(0.05);
    const velocity = spring.velocity;

    spring.target = 200;

    expect(spring.velocity).toBe(velocity);
  });

  it("jumps to the target when it is settled", () => {
    const spring = new Spring(0, { stiffness: 340, damping: 27 });
    spring.target = 100;
    spring.step(0.05);

    spring.settle();

    expect(spring.value).toBe(100);
    expect(spring.velocity).toBe(0);
  });
});

describe("springEasing", () => {
  it("bakes a spring into a linear() easing that runs from 0 to 1", () => {
    const { easing, durationMs } = springEasing({ stiffness: 320, damping: 26 });
    const points = easing.slice("linear(".length, -1).split(",").map(Number);

    expect(easing.startsWith("linear(")).toBe(true);
    expect(points[0]).toBe(0);
    expect(points.at(-1)).toBe(1);
    expect(Math.max(...points)).toBeGreaterThan(1);
    expect(durationMs).toBeGreaterThan(100);
    expect(durationMs).toBeLessThan(2000);
  });

  it("does not overshoot for an overdamped spring", () => {
    const { easing } = springEasing({ stiffness: 100, damping: 40 });
    const points = easing.slice("linear(".length, -1).split(",").map(Number);

    expect(Math.max(...points)).toBeLessThanOrEqual(1);
  });
});
