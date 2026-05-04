import { MessageBase } from "../../app-bus/app-bus";
import { ShellType } from "../../config/+models/config";
import { TerminalId } from "../../grid-list/+model/model";

export type TerminalTitle = {
  oscCode: 0 | 2;
  terminalId: TerminalId;
  title: string;
};

export type TerminalSearchLineMatch = {
  startIndex: number;
  endIndex: number;
};

export type TerminalSearchLineResult = {
  lineNumber: number;
  lineText: string;
  matches: TerminalSearchLineMatch[];
};

export type TerminalSearchRevealPayload = {
  terminalId: TerminalId;
  query: string;
  caseSensitive: boolean;
  regularExpression: boolean;
  lineNumber: number;
  matchStartIndex: number;
  matchLength: number;
};

export type PtyInitializedEvent = MessageBase<
  "PtyInitialized",
  { terminalId: TerminalId; shellType: ShellType }
>;
export type TerminalCwdChangedEvent = MessageBase<
  "TerminalCwdChanged",
  { terminalId: TerminalId; cwd: string }
>;
export type TerminalTitleChangedEvent = MessageBase<"TerminalTitleChanged", TerminalTitle>;
export type TerminalSearchRequestedEvent = MessageBase<
  "TerminalSearchRequested",
  {
    terminalId?: TerminalId;
    query: string;
    caseSensitive: boolean;
    regularExpression: boolean;
    beginBufferLine?: number;
    endBufferLine?: number;
    cursorBufferLine?: number;
    resultLineLimit?: number;
  }
>;
export type TerminalSearchPanelRequestedEvent = MessageBase<
  "TerminalSearchPanelRequested",
  {
    terminalId?: TerminalId;
    beginBufferLine?: number;
    endBufferLine?: number;
  }
>;
export type TerminalBusyChangedEvent = MessageBase<
  "TerminalBusyChanged",
  {
    terminalId: TerminalId;
    isBusy: boolean;
  }
>;
export type TerminalCursorRestoreRequestedEvent = MessageBase<"TerminalCursorRestoreRequested">;
export type TerminalSearchResultEvent = MessageBase<
  "TerminalSearchResult",
  {
    terminalId: TerminalId;
    query: string;
    caseSensitive: boolean;
    regularExpression: boolean;
    beginBufferLine?: number;
    endBufferLine?: number;
    cursorBufferLine?: number;
    hasMore: boolean;
    nextCursorBufferLine?: number;
    lines: TerminalSearchLineResult[];
  }
>;
export type TerminalSearchRevealRequestedEvent = MessageBase<
  "TerminalSearchRevealRequested",
  TerminalSearchRevealPayload
>;
