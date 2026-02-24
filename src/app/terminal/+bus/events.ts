import {MessageBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {ShellType} from '../../config/+models/config';

export type TerminalTitle = {
    oscCode: 0 | 2
    terminalId: TerminalId;
    title: string;
}

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
    lineNumber: number;
    matchStartIndex: number;
    matchLength: number;
};

export type PtyInitializedEvent = MessageBase<"PtyInitialized", {terminalId: TerminalId, shellType: ShellType}>
export type TerminalCwdChangedEvent = MessageBase<"TerminalCwdChanged", {terminalId: TerminalId, cwd: string}>
export type TerminalTitleChangedEvent = MessageBase<"TerminalTitleChanged", TerminalTitle>;
export type TerminalSearchRequestedEvent = MessageBase<"TerminalSearchRequested", {
    terminalId?: TerminalId;
    query: string;
    caseSensitive: boolean;
    regularExpression: boolean;
}>;
export type TerminalSearchResultEvent = MessageBase<"TerminalSearchResult", {
    terminalId: TerminalId;
    query: string;
    caseSensitive: boolean;
    regularExpression: boolean;
    lines: TerminalSearchLineResult[];
}>;
export type TerminalSearchRevealRequestedEvent = MessageBase<"TerminalSearchRevealRequested", TerminalSearchRevealPayload>;
