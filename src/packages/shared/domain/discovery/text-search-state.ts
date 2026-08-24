import {
  TerminalSearchLineResultContract,
  TerminalSearchTerminalIdContract,
} from "../terminal-search";

export interface TextSearchState {
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
