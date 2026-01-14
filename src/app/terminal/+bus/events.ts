import {MessageBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";
import {ShellType} from '../../config/+models/config';

export type PtyInitializedEvent = MessageBase<"PtyInitialized", {terminalId: TerminalId, shellType: ShellType}>
