import {
  TerminalSearchLineResultContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/shared/domain";

export interface TerminalSearchState {
  readonly query: string;
  readonly results: ReadonlyArray<TerminalSearchLineResultContract>;
  readonly caseSensitive: boolean;
  readonly regularExpression: boolean;
  readonly activeTerminalId?: TerminalSearchTerminalIdContract;
  readonly beginBufferLine?: number;
  readonly endBufferLine?: number;
  readonly hasMoreResults: boolean;
  readonly nextCursorBufferLine?: number;
}

export const initialTerminalSearchState: TerminalSearchState = {
  query: "",
  results: [],
  caseSensitive: false,
  regularExpression: false,
  hasMoreResults: false,
};

/** The id a result line is tracked and selected by. */
export function createSearchResultId(searchLine: TerminalSearchLineResultContract): string {
  return `${searchLine.lineNumber}:${searchLine.lineText}`;
}

/**
 * Whether a terminal's answer belongs to the search the panel shows right now.
 * Answers arrive late, so one for an older query, other options, another block
 * or another terminal must not replace the list.
 */
export function isAnswerToCurrentSearch(
  state: TerminalSearchState,
  terminalSearchResult: TerminalSearchResultContract,
): boolean {
  return (
    terminalSearchResult.terminalId === state.activeTerminalId &&
    terminalSearchResult.query === state.query.trim() &&
    terminalSearchResult.caseSensitive === state.caseSensitive &&
    terminalSearchResult.regularExpression === state.regularExpression &&
    terminalSearchResult.beginBufferLine === state.beginBufferLine &&
    terminalSearchResult.endBufferLine === state.endBufferLine
  );
}

/** The request that scrolls the terminal to the first match of a result line. */
export function buildRevealRequest(
  state: TerminalSearchState,
  searchLine: TerminalSearchLineResultContract,
): TerminalSearchRevealRequestContract | undefined {
  const firstLineMatch = searchLine.matches.at(0);
  if (!state.activeTerminalId || !firstLineMatch) {
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
