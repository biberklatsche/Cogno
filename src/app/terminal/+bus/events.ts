import {MessageBase} from "../../app-bus/app-bus";
import {TerminalId} from "../../grid-list/+model/model";

export type TerminalInitializedEvent = MessageBase<"TerminalInitializedEvent", TerminalId>