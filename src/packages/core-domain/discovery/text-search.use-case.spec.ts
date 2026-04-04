import { describe, expect, it } from "vitest";
import { TextSearchUseCase } from "./text-search.use-case";

describe("TextSearchUseCase", () => {
  it("creates a search request from the current search scope", () => {
    let state = TextSearchUseCase.createInitialState();
    state = TextSearchUseCase.applyScopeRequest(state, {
      terminalId: "terminal-1",
      beginBufferLine: 10,
      endBufferLine: 20,
    });
    state = TextSearchUseCase.setQuery(state, "needle");

    expect(TextSearchUseCase.createSearchRequest(state, state.activeTerminalId, undefined, 200)).toEqual({
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      beginBufferLine: 10,
      endBufferLine: 20,
      cursorBufferLine: undefined,
      resultLineLimit: 200,
    });
  });

  it("appends the next search result page when a cursor is provided", () => {
    let state = TextSearchUseCase.createInitialState();
    state = TextSearchUseCase.applyScopeRequest(state, { terminalId: "terminal-1" });
    state = TextSearchUseCase.setQuery(state, "needle");
    state = TextSearchUseCase.applySearchResult(state, {
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      hasMore: true,
      nextCursorBufferLine: 20,
      lines: [{ lineNumber: 3, lineText: "needle one", matches: [{ startIndex: 0, endIndex: 6 }] }],
    });

    state = TextSearchUseCase.applySearchResult(state, {
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      cursorBufferLine: 20,
      hasMore: false,
      lines: [{ lineNumber: 8, lineText: "needle two", matches: [{ startIndex: 0, endIndex: 6 }] }],
    });

    expect(state.results).toHaveLength(2);
    expect(state.nextCursorBufferLine).toBeUndefined();
  });

  it("builds a reveal request for a selected line", () => {
    let state = TextSearchUseCase.createInitialState();
    state = TextSearchUseCase.applyScopeRequest(state, { terminalId: "terminal-1" });
    state = TextSearchUseCase.setQuery(state, "needle");

    expect(TextSearchUseCase.buildRevealRequest(state, {
      lineNumber: 42,
      lineText: "needle value",
      matches: [{ startIndex: 0, endIndex: 6 }],
    })).toEqual({
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      lineNumber: 42,
      matchStartIndex: 0,
      matchLength: 6,
    });
  });
});
