import {
  TerminalSearchLineResultContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/core-api";
import { TerminalSearchState } from "./terminal-search-state";

export class TerminalSearchUseCase {
  static createInitialState(): TerminalSearchState {
    return {
      query: "",
      results: [],
      caseSensitive: false,
      regularExpression: false,
      activeTerminalId: undefined,
      beginBufferLine: undefined,
      endBufferLine: undefined,
      hasMoreResults: false,
      nextCursorBufferLine: undefined,
    };
  }

  static setQuery(state: TerminalSearchState, query: string): TerminalSearchState {
    return {
      ...state,
      query,
    };
  }

  static toggleCaseSensitive(state: TerminalSearchState): TerminalSearchState {
    return {
      ...state,
      caseSensitive: !state.caseSensitive,
    };
  }

  static toggleRegularExpression(state: TerminalSearchState): TerminalSearchState {
    return {
      ...state,
      regularExpression: !state.regularExpression,
    };
  }

  static applyPanelRequest(
    state: TerminalSearchState,
    panelRequest: TerminalSearchPanelRequestContract,
  ): TerminalSearchState {
    return {
      ...state,
      activeTerminalId: panelRequest.terminalId,
      beginBufferLine: panelRequest.beginBufferLine,
      endBufferLine: panelRequest.endBufferLine,
      results: [],
      hasMoreResults: false,
      nextCursorBufferLine: undefined,
    };
  }

  static clearBlockSearch(state: TerminalSearchState): TerminalSearchState {
    return {
      ...state,
      beginBufferLine: undefined,
      endBufferLine: undefined,
    };
  }

  static setActiveTerminalId(
    state: TerminalSearchState,
    activeTerminalId: TerminalSearchTerminalIdContract | undefined,
  ): TerminalSearchState {
    return {
      ...state,
      activeTerminalId,
    };
  }

  static clearForSideMenuClose(): TerminalSearchState {
    return this.createInitialState();
  }

  static createSearchRequest(
    state: TerminalSearchState,
    activeTerminalId: TerminalSearchTerminalIdContract | undefined,
    cursorBufferLine: number | undefined,
    resultLineLimit: number,
  ): TerminalSearchRequestContract | undefined {
    if (!activeTerminalId) {
      return undefined;
    }

    return {
      terminalId: activeTerminalId,
      query: state.query,
      caseSensitive: state.caseSensitive,
      regularExpression: state.regularExpression,
      beginBufferLine: state.beginBufferLine,
      endBufferLine: state.endBufferLine,
      cursorBufferLine,
      resultLineLimit,
    };
  }

  static applyMissingTerminalResult(state: TerminalSearchState): TerminalSearchState {
    return {
      ...state,
      results: [],
      hasMoreResults: false,
      nextCursorBufferLine: undefined,
    };
  }

  static applySearchResult(
    state: TerminalSearchState,
    terminalSearchResult: TerminalSearchResultContract,
  ): TerminalSearchState {
    if (terminalSearchResult.terminalId !== state.activeTerminalId) {
      return state;
    }

    if (terminalSearchResult.query !== state.query.trim()) {
      return state;
    }

    if (terminalSearchResult.caseSensitive !== state.caseSensitive) {
      return state;
    }

    if (terminalSearchResult.regularExpression !== state.regularExpression) {
      return state;
    }

    if (terminalSearchResult.beginBufferLine !== state.beginBufferLine) {
      return state;
    }

    if (terminalSearchResult.endBufferLine !== state.endBufferLine) {
      return state;
    }

    return this.applySearchResultPage(
      state,
      terminalSearchResult.lines,
      terminalSearchResult.hasMore,
      terminalSearchResult.nextCursorBufferLine,
      terminalSearchResult.cursorBufferLine !== undefined,
    );
  }

  static buildRevealRequest(
    state: TerminalSearchState,
    searchLine: TerminalSearchLineResultContract,
  ): TerminalSearchRevealRequestContract | undefined {
    if (!state.activeTerminalId) {
      return undefined;
    }

    const firstLineMatch = searchLine.matches.at(0);
    if (!firstLineMatch) {
      return undefined;
    }

    return {
      terminalId: state.activeTerminalId,
      query: state.query.trim(),
      caseSensitive: state.caseSensitive,
      regularExpression: state.regularExpression,
      lineNumber: searchLine.lineNumber,
      matchStartIndex: firstLineMatch.startIndex,
      matchLength: firstLineMatch.endIndex - firstLineMatch.startIndex,
    };
  }

  private static applySearchResultPage(
    state: TerminalSearchState,
    lines: ReadonlyArray<TerminalSearchLineResultContract>,
    hasMoreResults: boolean,
    nextCursorBufferLine: number | undefined,
    appendResults: boolean,
  ): TerminalSearchState {
    const nextResults = appendResults
      ? [...state.results, ...lines]
      : [...lines];

    return {
      ...state,
      results: nextResults,
      hasMoreResults,
      nextCursorBufferLine,
    };
  }
}
