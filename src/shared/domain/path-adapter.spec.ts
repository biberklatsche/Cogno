import { describe, expect, it } from "vitest";
import { relativeCognoPath } from "./path-adapter";

describe("relativeCognoPath", () => {
  it("gives a path inside the base relative to it", () => {
    expect(relativeCognoPath("/c/repo", "/c/repo/src/a.ts")).toBe("src/a.ts");
    expect(relativeCognoPath("/", "/etc/hosts")).toBe("etc/hosts");
    expect(relativeCognoPath("//wsl/Ubuntu/home/me", "//wsl/Ubuntu/home/me/x")).toBe("x");
  });

  it("is undefined for the base itself, a sibling with the same prefix, or a path outside", () => {
    expect(relativeCognoPath("/c/repo", "/c/repo")).toBeUndefined();
    expect(relativeCognoPath("/c/repo", "/c/repository/a.ts")).toBeUndefined();
    expect(relativeCognoPath("/c/repo", "/d/other.ts")).toBeUndefined();
  });
});
