import { MessageBase } from "@cogno/core/workbench/bus/message-base";

export type TerminalIpcMessageEvent = MessageBase<
  "TerminalIpcMessage",
  { command: string; args?: string[]; terminalId?: string; payload?: unknown }
>;
