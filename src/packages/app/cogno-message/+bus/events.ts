import { MessageBase } from "../../app-bus/app-bus";

export type TerminalIpcMessageEvent = MessageBase<
  "TerminalIpcMessage",
  { command: string; args?: string[]; terminalId?: string }
>;
