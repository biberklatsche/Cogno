import type { TerminalSearchResultContract } from "@cogno/shared/domain";
import { describe, expect, it } from "vitest";
import {
  buildRevealRequest,
  initialTerminalSearchState,
  isAnswerToCurrentSearch,
  type TerminalSearchState,
} from "./terminal-search-state";

const state: TerminalSearchState = {
  ...initialTerminalSearchState,
  activeTerminalId: "terminal-1",
  query: " needle ",
  caseSensitive: true,
  beginBufferLine: 10,
  endBufferLine: 20,
};

const answer: TerminalSearchResultContract = {
  terminalId: "terminal-1",
  query: "needle",
  caseSensitive: true,
  regularExpression: false,
  beginBufferLine: 10,
  endBufferLine: 20,
  hasMore: false,
  lines: [],
};

describe("isAnswerToCurrentSearch", () => {
  it("accepts an answer that echoes the terminal, the trimmed query, the options and the block", () => {
    expect(isAnswerToCurrentSearch(state, answer)).toBe(true);
    expect(isAnswerToCurrentSearch(state, { ...answer, cursorBufferLine: 40 })).toBe(true);
  });

  it.each<[string, Partial<TerminalSearchResultContract>]>([
    ["terminal", { terminalId: "terminal-2" }],
    ["query", { query: "needl" }],
    ["untrimmed query", { query: " needle " }],
    ["case sensitivity", { caseSensitive: false }],
    ["regular expression mode", { regularExpression: true }],
    ["block start", { beginBufferLine: undefined }],
    ["block end", { endBufferLine: 21 }],
  ])("rejects an answer with another %s", (_name, staleFields) => {
    expect(isAnswerToCurrentSearch(state, { ...answer, ...staleFields })).toBe(false);
  });

  it("rejects every answer while no terminal is being searched", () => {
    expect(isAnswerToCurrentSearch(initialTerminalSearchState, { ...answer, query: "" })).toBe(
      false,
    );
  });
});

describe("buildRevealRequest", () => {
  it("points at the first match of the line, with the trimmed query", () => {
    expect(
      buildRevealRequest(state, {
        lineNumber: 42,
        lineText: "a needle, needle",
        matches: [
          { startIndex: 2, endIndex: 8 },
          { startIndex: 10, endIndex: 16 },
        ],
      }),
    ).toEqual({
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: true,
      regularExpression: false,
      lineNumber: 42,
      matchStartIndex: 2,
      matchLength: 6,
    });
  });

  it("has nothing to reveal for a line without matches or without a terminal", () => {
    expect(buildRevealRequest(state, { lineNumber: 42, lineText: "plain", matches: [] })).toBe(
      undefined,
    );
    expect(
      buildRevealRequest(initialTerminalSearchState, {
        lineNumber: 42,
        lineText: "needle",
        matches: [{ startIndex: 0, endIndex: 6 }],
      }),
    ).toBe(undefined);
  });
});
