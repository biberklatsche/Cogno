import { Observable } from "rxjs";

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

export interface TerminalSearchHostPortContract {
  readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;
  getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  requestSearchDecorationClear(): void;
  requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}

export abstract class TerminalSearchHostPort implements TerminalSearchHostPortContract {
  abstract readonly terminalSearchResult$: Observable<TerminalSearchResultContract>;
  abstract readonly terminalSearchColorConfig$: Observable<TerminalSearchColorConfigContract>;
  abstract readonly terminalSearchPanelRequest$: Observable<TerminalSearchPanelRequestContract>;
  abstract getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  abstract requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  abstract requestSearchDecorationClear(): void;
  abstract requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}


