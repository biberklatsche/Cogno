import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import {
  TerminalId,
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
