import {
  TerminalSearchLineResultContract,
  TerminalSearchPanelRequestContract,
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/core-api";
import { TextSearchState } from "./text-search-state";

export class TextSearchUseCase {
  static createInitialState(): TextSearchState {
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

  static setQuery(state: TextSearchState, query: string): TextSearchState {
    return {
      ...state,
      query,
    };
  }

  static toggleCaseSensitive(state: TextSearchState): TextSearchState {
    return {
      ...state,
      caseSensitive: !state.caseSensitive,
    };
  }

  static toggleRegularExpression(state: TextSearchState): TextSearchState {
    return {
      ...state,
      regularExpression: !state.regularExpression,
    };
  }

  static applyScopeRequest(
    state: TextSearchState,
    panelRequest: TerminalSearchPanelRequestContract,
  ): TextSearchState {
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

  static clearSearchScope(state: TextSearchState): TextSearchState {
    return {
      ...state,
      beginBufferLine: undefined,
      endBufferLine: undefined,
    };
  }

  static setActiveCollectionId(
    state: TextSearchState,
    activeTerminalId: TerminalSearchTerminalIdContract | undefined,
  ): TextSearchState {
    return {
      ...state,
      activeTerminalId,
    };
  }

  static clearForCollectionClose(): TextSearchState {
    return this.createInitialState();
  }

  static createSearchRequest(
    state: TextSearchState,
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

  static applyMissingCollectionResult(state: TextSearchState): TextSearchState {
    return {
      ...state,
      results: [],
      hasMoreResults: false,
      nextCursorBufferLine: undefined,
    };
  }

  static applySearchResult(
    state: TextSearchState,
    terminalSearchResult: TerminalSearchResultContract,
  ): TextSearchState {
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
    state: TextSearchState,
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
    state: TextSearchState,
    lines: ReadonlyArray<TerminalSearchLineResultContract>,
    hasMoreResults: boolean,
    nextCursorBufferLine: number | undefined,
    appendResults: boolean,
  ): TextSearchState {
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
