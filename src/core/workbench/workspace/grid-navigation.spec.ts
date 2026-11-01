import { describe, expect, it } from "vitest";
import { nextGridIndex } from "./grid-navigation";

describe("nextGridIndex", () => {
  /*
    two columns, five tiles:
      0 1
      2 3
      4
  */
  const two = (index: number, direction: Parameters<typeof nextGridIndex>[3]) =>
    nextGridIndex(index, 5, 2, direction);

  it("moves within the row and wraps inside it", () => {
    expect(two(0, "right")).toBe(1);
    expect(two(1, "right")).toBe(0);
    expect(two(1, "left")).toBe(0);
    expect(two(0, "left")).toBe(1);
  });

  it("moves within the column and wraps inside it", () => {
    expect(two(0, "down")).toBe(2);
    expect(two(2, "down")).toBe(4);
    expect(two(4, "down")).toBe(0);
    expect(two(1, "down")).toBe(3);
    expect(two(4, "up")).toBe(2);
    expect(two(0, "up")).toBe(4);
    expect(two(1, "up")).toBe(3);
  });

  it("reaches the lone tile of a short last row from the other column", () => {
    expect(two(3, "down")).toBe(4);
    expect(two(3, "up")).toBe(1);
  });

  it("leaves the lone tile sideways to the row above", () => {
    expect(two(4, "right")).toBe(0);
    expect(two(4, "left")).toBe(3);
  });

  it("treats every direction as next or previous in a single column", () => {
    const one = (index: number, direction: Parameters<typeof nextGridIndex>[3]) =>
      nextGridIndex(index, 3, 1, direction);
    expect(one(0, "right")).toBe(1);
    expect(one(2, "right")).toBe(0);
    expect(one(0, "down")).toBe(1);
    expect(one(2, "down")).toBe(0);
    expect(one(1, "left")).toBe(0);
    expect(one(0, "left")).toBe(2);
    expect(one(0, "up")).toBe(2);
  });

  it("toggles between the two tiles of a single row", () => {
    expect(nextGridIndex(0, 2, 2, "down")).toBe(1);
    expect(nextGridIndex(1, 2, 2, "up")).toBe(0);
    expect(nextGridIndex(1, 2, 2, "down")).toBe(0);
  });

  it("never moves with fewer than two tiles", () => {
    expect(nextGridIndex(0, 1, 2, "right")).toBe(0);
    expect(nextGridIndex(0, 0, 2, "down")).toBe(0);
  });
});
