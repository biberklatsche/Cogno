import { describe, expect, it } from "vitest";
import { detectGitDiffLanguage } from "./git-diff.service";

describe("detectGitDiffLanguage", () => {
  it.each([
    ["src/app/main.ts", "typescript"],
    ["src/app/main.tsx", "typescript"],
    ["src/app/main.js", "javascript"],
    ["src/app/main.jsx", "javascript"],
    ["main.py", "python"],
    ["main.rs", "rust"],
    ["main.go", "go"],
    ["Main.java", "java"],
    ["main.cpp", "cpp"],
    ["config.json", "json"],
    ["config.yaml", "yaml"],
    ["config.yml", "yaml"],
    ["README.md", "markdown"],
    ["index.html", "html"],
    ["styles.css", "css"],
    ["styles.scss", "scss"],
    ["schema.sql", "sql"],
  ])("detects %s as %s", (filePath, expected) => {
    expect(detectGitDiffLanguage(filePath)).toBe(expected);
  });

  it("returns text for unknown extensions", () => {
    expect(detectGitDiffLanguage("binary.wasm")).toBe("text");
    expect(detectGitDiffLanguage("Makefile")).toBe("text");
  });

  it("returns text for files without extension", () => {
    expect(detectGitDiffLanguage("Dockerfile")).toBe("text");
  });

  it("uses the last extension for dotfiles", () => {
    expect(detectGitDiffLanguage(".gitignore")).toBe("text");
    expect(detectGitDiffLanguage("archive.tar.gz")).toBe("text");
  });

  it("is case-insensitive for extensions", () => {
    expect(detectGitDiffLanguage("Main.TS")).toBe("typescript");
    expect(detectGitDiffLanguage("Main.PY")).toBe("python");
  });
});
