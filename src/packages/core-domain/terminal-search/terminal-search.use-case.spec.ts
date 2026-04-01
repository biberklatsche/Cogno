import { describe, expect, it } from "vitest";
import { TerminalSearchUseCase } from "./terminal-search.use-case";

describe("TerminalSearchUseCase", () => {
  it("applies a panel request and creates a search request from it", () => {
    let state = TerminalSearchUseCase.createInitialState();
    state = TerminalSearchUseCase.applyPanelRequest(state, {
      terminalId: "terminal-1",
      beginBufferLine: 10,
      endBufferLine: 20,
    });
    state = TerminalSearchUseCase.setQuery(state, "needle");

    expect(TerminalSearchUseCase.createSearchRequest(state, state.activeTerminalId, undefined, 200)).toEqual({
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

  it("appends follow-up result pages", () => {
    let state = TerminalSearchUseCase.createInitialState();
    state = TerminalSearchUseCase.applyPanelRequest(state, { terminalId: "terminal-1" });
    state = TerminalSearchUseCase.setQuery(state, "needle");
    state = TerminalSearchUseCase.applySearchResult(state, {
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      hasMore: true,
      nextCursorBufferLine: 20,
      lines: [{ lineNumber: 1, lineText: "needle one", matches: [{ startIndex: 0, endIndex: 6 }] }],
    });
    state = TerminalSearchUseCase.applySearchResult(state, {
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      cursorBufferLine: 20,
      hasMore: false,
      lines: [{ lineNumber: 2, lineText: "needle two", matches: [{ startIndex: 0, endIndex: 6 }] }],
    });

    expect(state.results).toHaveLength(2);
    expect(state.hasMoreResults).toBe(false);
  });

  it("builds a reveal request from the first match", () => {
    let state = TerminalSearchUseCase.createInitialState();
    state = TerminalSearchUseCase.applyPanelRequest(state, { terminalId: "terminal-1" });
    state = TerminalSearchUseCase.setQuery(state, "needle");

    expect(TerminalSearchUseCase.buildRevealRequest(state, {
      lineNumber: 3,
      lineText: "needle",
      matches: [{ startIndex: 2, endIndex: 8 }],
    })).toEqual({
      terminalId: "terminal-1",
      query: "needle",
      caseSensitive: false,
      regularExpression: false,
      lineNumber: 3,
      matchStartIndex: 2,
      matchLength: 6,
    });
  });
});
