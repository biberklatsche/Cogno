import { MessageBase } from "@cogno/core/workbench/bus/app-bus";

export type TerminalIpcMessageEvent = MessageBase<
  "TerminalIpcMessage",
  { command: string; args?: string[]; terminalId?: string; payload?: unknown }
>;
