import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { MessageBase } from "@cogno/core/workbench/bus/app-bus";
import {
  TerminalSearchRequestContract,
  TerminalSearchResultContract,
  TerminalSearchRevealRequestContract,
} from "@cogno/shared/domain";
import { TerminalId } from "@cogno/shared/ports";

export type TerminalTitle = {
  oscCode: 0 | 2;
  terminalId: TerminalId;
  title: string;
};

export type PtyInitializedEvent = MessageBase<
  "PtyInitialized",
  { terminalId: TerminalId; shellType: ShellType }
>;
export type TerminalCwdChangedEvent = MessageBase<
  "TerminalCwdChanged",
  { terminalId: TerminalId; cwd: string }
>;
export type TerminalTitleChangedEvent = MessageBase<"TerminalTitleChanged", TerminalTitle>;
export type TerminalSearchRequestedEvent = MessageBase<
  "TerminalSearchRequested",
  TerminalSearchRequestContract
>;
export type TerminalSearchPanelRequestedEvent = MessageBase<
  "TerminalSearchPanelRequested",
  {
    terminalId?: TerminalId;
    beginBufferLine?: number;
    endBufferLine?: number;
  }
>;
export type TerminalBusyChangedEvent = MessageBase<
  "TerminalBusyChanged",
  {
    terminalId: TerminalId;
    isBusy: boolean;
  }
>;
export type TerminalFocusedEvent = MessageBase<"TerminalFocused", TerminalId>;
export type TerminalBlurredEvent = MessageBase<"TerminalBlurred", TerminalId>;
export type FullScreenAppEnteredEvent = MessageBase<"FullScreenAppEntered", TerminalId>;
export type FullScreenAppLeavedEvent = MessageBase<"FullScreenAppLeaved", TerminalId>;
export type TerminalSearchResultEvent = MessageBase<
  "TerminalSearchResult",
  TerminalSearchResultContract
>;
export type TerminalSearchRevealRequestedEvent = MessageBase<
  "TerminalSearchRevealRequested",
  TerminalSearchRevealRequestContract
>;
