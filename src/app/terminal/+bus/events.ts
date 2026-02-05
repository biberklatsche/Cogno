import {MessageBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {ShellType} from '../../config/+models/config';

export type TerminalTitle = {
    oscCode: 0 | 2
    terminalId: TerminalId;
    title: string;
}

export type PtyInitializedEvent = MessageBase<"PtyInitialized", {terminalId: TerminalId, shellType: ShellType}>
export type TerminalCwdChangedEvent = MessageBase<"TerminalCwdChanged", {terminalId: TerminalId, cwd: string}>
export type TerminalTitleChangedEvent = MessageBase<"TerminalTitleChanged", TerminalTitle>;
