import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PacedLoad } from "./paced-load";

describe("PacedLoad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });
  afterEach(() => vi.useRealTimers());

  it("loads a single change at once", () => {
    const load = vi.fn();

    new PacedLoad().start(load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads only where a fast-moving selection comes to rest", () => {
    const paced = new PacedLoad();
    const passed = vi.fn();
    const rested = vi.fn();
    paced.start(vi.fn());

    vi.advanceTimersByTime(30);
    paced.start(passed);
    vi.advanceTimersByTime(30);
    paced.start(rested);
    vi.advanceTimersByTime(500);

    expect(passed).not.toHaveBeenCalled();
    expect(rested).toHaveBeenCalledTimes(1);
  });

  it("loads at once again after a pause", () => {
    const paced = new PacedLoad();
    const load = vi.fn();
    paced.start(vi.fn());

    vi.advanceTimersByTime(500);
    paced.start(load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("drops a waiting load when cancelled", () => {
    const paced = new PacedLoad();
    const load = vi.fn();
    paced.start(vi.fn());
    paced.start(load);

    paced.cancel();
    vi.advanceTimersByTime(500);

    expect(load).not.toHaveBeenCalled();
  });
});
