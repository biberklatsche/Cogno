import { describe, expect, it } from "vitest";
import { parseBashHistory, parseZshHistory } from "./shell-history-reader";

describe("parseBashHistory", () => {
  it("parses plain lines into entries", () => {
    const result = parseBashHistory("git status\nnpm install\ngit commit");
    expect(result.map((e) => e.command)).toEqual(["git status", "npm install", "git commit"]);
  });

  it("skips empty lines", () => {
    const result = parseBashHistory("git status\n\nnpm install\n");
    expect(result.map((e) => e.command)).toEqual(["git status", "npm install"]);
  });

  it("trims whitespace from commands", () => {
    const result = parseBashHistory("  git status  \n  npm install  ");
    expect(result.map((e) => e.command)).toEqual(["git status", "npm install"]);
  });

  it("preserves insertion order via ascending timestamps", () => {
    const result = parseBashHistory("first\nsecond\nthird");
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
    expect(result[1].timestamp).toBeLessThan(result[2].timestamp);
  });

  it("returns empty array for empty content", () => {
    expect(parseBashHistory("")).toEqual([]);
    expect(parseBashHistory("   \n  \n")).toEqual([]);
  });
});

describe("parseZshHistory", () => {
  it("parses extended format with real timestamps", () => {
    const result = parseZshHistory(": 1700000000:0;git status\n: 1700000060:0;npm install");
    expect(result).toEqual([
      { command: "git status", timestamp: 1700000000 * 1000 },
      { command: "npm install", timestamp: 1700000060 * 1000 },
    ]);
  });

  it("parses simple format (no timestamp prefix)", () => {
    const result = parseZshHistory("git status\nnpm install");
    expect(result.map((e) => e.command)).toEqual(["git status", "npm install"]);
  });

  it("handles mixed extended and simple lines", () => {
    const result = parseZshHistory(": 1700000000:0;git status\nnpm install");
    expect(result[0]).toEqual({ command: "git status", timestamp: 1700000000 * 1000 });
    expect(result[1].command).toBe("npm install");
  });

  it("skips empty lines", () => {
    const result = parseZshHistory(": 1700000000:0;git status\n\n: 1700000060:0;npm install");
    expect(result).toHaveLength(2);
  });

  it("preserves insertion order for simple-format entries via ascending timestamps", () => {
    const result = parseZshHistory("first\nsecond\nthird");
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
    expect(result[1].timestamp).toBeLessThan(result[2].timestamp);
  });

  it("returns empty array for empty content", () => {
    expect(parseZshHistory("")).toEqual([]);
  });
});
