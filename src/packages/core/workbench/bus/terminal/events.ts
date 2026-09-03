import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import {
  TerminalSearchRequestContract,
  TerminalSearchRevealRequestContract,
} from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";

export type TerminalSearchRequestedEvent = MessageBase<
  "TerminalSearchRequested",
  TerminalSearchRequestContract
>;
export type TerminalSearchRevealRequestedEvent = MessageBase<
  "TerminalSearchRevealRequested",
  TerminalSearchRevealRequestContract
>;
