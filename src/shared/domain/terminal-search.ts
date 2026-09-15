export type TerminalSearchTerminalIdContract = string;

export interface TerminalSearchLineMatchContract {
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface TerminalSearchLineResultContract {
  readonly lineNumber: number;
  readonly lineText: string;
  readonly matches: ReadonlyArray<TerminalSearchLineMatchContract>;
}

export interface TerminalSearchResultContract {
  readonly terminalId: TerminalSearchTerminalIdContract;
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly regularExpression: boolean;
  readonly beginBufferLine?: number;
  readonly endBufferLine?: number;
  readonly cursorBufferLine?: number;
  readonly hasMore: boolean;
  readonly nextCursorBufferLine?: number;
  readonly lines: ReadonlyArray<TerminalSearchLineResultContract>;
}

export interface TerminalSearchColorConfigContract {
  readonly matchBackgroundColor?: string;
  readonly matchBorderColor?: string;
}

export interface TerminalSearchPanelRequestContract {
  readonly terminalId?: TerminalSearchTerminalIdContract;
  readonly beginBufferLine?: number;
  readonly endBufferLine?: number;
}

export interface TerminalSearchRequestContract {
  readonly terminalId?: TerminalSearchTerminalIdContract;
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly regularExpression: boolean;
  readonly beginBufferLine?: number;
  readonly endBufferLine?: number;
  readonly cursorBufferLine?: number;
  readonly resultLineLimit?: number;
}

export interface TerminalSearchRevealRequestContract {
  readonly terminalId: TerminalSearchTerminalIdContract;
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly regularExpression: boolean;
  readonly lineNumber: number;
  readonly matchStartIndex: number;
  readonly matchLength: number;
}
