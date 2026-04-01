import {
  TerminalSearchLineResultContract,
  TerminalSearchTerminalIdContract,
} from "@cogno/core-api";

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
