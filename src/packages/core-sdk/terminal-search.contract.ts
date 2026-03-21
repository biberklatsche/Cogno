import { InjectionToken } from "@angular/core";
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
  readonly lines: ReadonlyArray<TerminalSearchLineResultContract>;
}

export interface TerminalSearchColorConfigContract {
  readonly matchBackgroundColor?: string;
  readonly matchBorderColor?: string;
}

export interface TerminalSearchRequestContract {
  readonly terminalId?: TerminalSearchTerminalIdContract;
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly regularExpression: boolean;
  readonly beginBufferLine?: number;
  readonly endBufferLine?: number;
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
  getFocusedTerminalId(): TerminalSearchTerminalIdContract | undefined;
  requestSearch(terminalSearchRequest: TerminalSearchRequestContract): void;
  requestSearchDecorationClear(): void;
  requestReveal(terminalSearchRevealRequest: TerminalSearchRevealRequestContract): void;
}

export const terminalSearchHostPortToken = new InjectionToken<TerminalSearchHostPortContract>(
  "terminal-search-host-port-token",
);
