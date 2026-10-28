import { describe, expect, it } from "vitest";
import { detectGitDiffLanguage } from "./git-diff-languages";

describe("detectGitDiffLanguage", () => {
  it("tells a language by its extension, whatever the case", () => {
    expect(detectGitDiffLanguage("src/app/Main.TS")).toBe(detectGitDiffLanguage("a.ts"));
    expect(detectGitDiffLanguage("README.md")).toBe(detectGitDiffLanguage("notes.mdx"));
  });

  it("knows well-known files by name, before their extension", () => {
    expect(detectGitDiffLanguage("docker/Dockerfile")).toBeDefined();
    expect(detectGitDiffLanguage("Gemfile")).toBe(detectGitDiffLanguage("x.rb"));
    expect(detectGitDiffLanguage(".bashrc")).toBe(detectGitDiffLanguage("x.sh"));
    expect(detectGitDiffLanguage("nginx.conf")).toBeDefined();
    expect(detectGitDiffLanguage("other.conf")).toBeUndefined();
  });

  it("has no language for a file it does not know", () => {
    expect(detectGitDiffLanguage("Makefile")).toBeUndefined();
    expect(detectGitDiffLanguage("data.bin")).toBeUndefined();
  });
});
