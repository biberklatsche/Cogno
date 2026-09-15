import { describe, expect, it } from "vitest";
import { MachineState } from "./machine-state";

describe("MachineState", () => {
  it("stores bounded terminal progress state", () => {
    const state = new MachineState();

    state.setProgress("warning", 132);

    expect(state.state.progress).toEqual({ state: "warning", value: 100 });
  });

  it("clears terminal progress when hidden state is set", () => {
    const state = new MachineState();

    state.setProgress("default", 55);
    state.setProgress("hidden", 55);

    expect(state.state.progress).toEqual({ state: "hidden", value: 0 });
  });

  it("does not emit when the scroll position is unchanged", () => {
    const state = new MachineState();
    let emissions = 0;
    state.state$.subscribe(() => emissions++);

    state.setScrolledLinesFromBottom(3);
    state.setScrolledLinesFromBottom(3);

    expect(emissions).toBe(2); // initial + one change
    expect(state.scrolledLinesFromBottom).toBe(3);
  });
});
