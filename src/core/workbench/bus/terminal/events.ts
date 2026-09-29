import { MessageBase } from "@cogno/core/workbench/bus/message-base";
import {
  TerminalSearchRequestContract,
  TerminalSearchRevealRequestContract,
} from "@cogno/shared/domain";

export type TerminalSearchRequestedEvent = MessageBase<
  "TerminalSearchRequested",
  TerminalSearchRequestContract
>;
export type TerminalSearchRevealRequestedEvent = MessageBase<
  "TerminalSearchRevealRequested",
  TerminalSearchRevealRequestContract
>;
