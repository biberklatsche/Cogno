import { describe, expect, it } from "vitest";
import { Grid } from "./grid-calculations";

describe("Grid.nextIndex", () => {
  it("moves horizontally with wrap-around", () => {
    expect(Grid.nextIndex(0, "l", 3, 6)).toBe(2);
    expect(Grid.nextIndex(2, "r", 3, 6)).toBe(0);
  });

  it("moves vertically with wrap-around in a full grid", () => {
    expect(Grid.nextIndex(1, "u", 3, 6)).toBe(4);
    expect(Grid.nextIndex(4, "d", 3, 6)).toBe(1);
  });

  it("handles incomplete last rows for vertical movement", () => {
    expect(Grid.nextIndex(1, "d", 3, 5)).toBe(4);
    expect(Grid.nextIndex(4, "d", 3, 5)).toBe(1);
  });

  it("falls back to the last valid index for lateral movement into empty cells", () => {
    expect(Grid.nextIndex(3, "r", 3, 5)).toBe(4);
    expect(Grid.nextIndex(4, "r", 3, 5)).toBe(4);
  });

  it("handles upward movement into sparse rows", () => {
    expect(Grid.nextIndex(1, "u", 4, 6)).toBe(5);
  });
});
