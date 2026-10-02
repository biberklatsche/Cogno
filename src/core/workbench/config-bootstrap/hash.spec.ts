import { describe, expect, it } from "vitest";
import { Hash } from "./hash";

describe("Hash", () => {
  it("creates stable 32-bit hashes", () => {
    expect(Hash.create("abc")).toBe(Hash.create("abc"));
    expect(Hash.create("abc")).not.toBe(Hash.create("abd"));
  });

  it("returns zero for empty input", () => {
    expect(Hash.create("")).toBe(0);
  });
});
