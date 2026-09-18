import { describe, expect, it } from "vitest";
import { ZshPathAdapter } from "./zsh.path-adapter";

describe("ZshPathAdapter", () => {
  const adapter = new ZshPathAdapter({ backendOs: "macos" });

  it("should normalize windows drives to cogno paths", () => {
    expect(adapter.normalize("C:\\temp\\file.txt")).toBe("/c/temp/file.txt");
  });

  it("should render posix paths normally", () => {
    expect(adapter.render("/c/temp/file.txt", { purpose: "display" })).toBe("/c/temp/file.txt");
  });

  it("should quote if needed", () => {
    expect(adapter.render("/path/with space", { purpose: "insert_arg" })).toBe(
      "'/path/with space'",
    );
  });
});
