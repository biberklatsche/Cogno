import { describe, expect, it } from "vitest";
import { isHistorySource, isLocalHistorySource } from "./suggestion-source";

describe("suggestion source", () => {
  it.each([
    ["history-cmd", true],
    ["history-cmd-local", true],
    ["history-dir", true],
    ["history-pattern", true],
    ["history-collapse", true],
    ["history-cmd + spec-cmd", true],
    ["spec-cmd", false],
    ["", false],
  ])("counts %j as history: %s", (source, expected) => {
    expect(isHistorySource(source)).toBe(expected);
  });

  it.each([
    ["history-cmd-local", true],
    ["history-cmd-local + spec-cmd", true],
    ["history-cmd", false],
    ["history-cmd-local-extra", false],
    ["spec-cmd", false],
  ])("counts %j as local history: %s", (source, expected) => {
    expect(isLocalHistorySource(source)).toBe(expected);
  });
});
