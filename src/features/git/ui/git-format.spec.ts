import { describe, expect, it } from "vitest";
import { formatAge } from "./git-format";

const DAY = 24 * 60 * 60;

describe("formatAge", () => {
  it("counts days, then months, then years older than the reference", () => {
    const reference = 1000 * DAY;

    expect(formatAge(reference - 3 * DAY, reference)).toBe("3 d");
    expect(formatAge(reference - 150 * DAY, reference)).toBe("5 mo");
    expect(formatAge(reference - 800 * DAY, reference)).toBe("2 y");
    expect(formatAge(reference, reference)).toBe("0 d");
  });
});
