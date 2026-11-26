import { describe, expect, it } from "vitest";
import { nextStop } from "./git-list-walk";

describe("nextStop", () => {
  const rows = ["a", "b", "c"];

  it("moves one row up or down", () => {
    expect(nextStop(rows, 1, 1)).toBe("c");
    expect(nextStop(rows, 1, -1)).toBe("a");
  });

  it("stays at the ends instead of wrapping around", () => {
    expect(nextStop(rows, 2, 1)).toBeUndefined();
    expect(nextStop(rows, 0, -1)).toBeUndefined();
  });

  it("starts at the first row when none is current", () => {
    expect(nextStop(rows, -1, 1)).toBe("a");
    expect(nextStop(rows, -1, -1)).toBe("a");
  });

  it("has nowhere to go in an empty list", () => {
    expect(nextStop([], -1, 1)).toBeUndefined();
  });
});
