import { ActionFiredEvent } from "@cogno/core/workbench/bus/action.models";
import {
  BusyIndicatorClearForTerminalEvent,
  BusyIndicatorRegisterEvent,
  BusyIndicatorUnregisterEvent,
} from "@cogno/core/workbench/bus/busy-indicator/events";
import { TerminalIpcMessageEvent } from "@cogno/core/workbench/bus/cogno-message/events";
import { InitConfigAction } from "@cogno/core/workbench/bus/config/actions";
import { ConfigLoadedEvent, DBInitializedEvent } from "@cogno/core/workbench/bus/config/events";
import { FocusActiveTerminalAction } from "@cogno/core/workbench/bus/grid-list/actions";
import {
  ChangeTabTitleEvent,
  PaneMaximizedChangedEvent,
  VisibleTerminalsChangedEvent,
} from "@cogno/core/workbench/bus/grid-list/events";
import { OpenNotificationTargetAction } from "@cogno/core/workbench/bus/notification/actions";
import { NotificationEvent } from "@cogno/core/workbench/bus/notification/events";
import { SideMenuEvent } from "@cogno/core/workbench/bus/side-menu/events";
import {
  CreateTabAction,
  RemoveTabAction,
  SelectTabAction,
} from "@cogno/core/workbench/bus/tab-list/actions";
import {
  TabAddedEvent,
  TabRemovedEvent,
  TabSelectedEvent,
} from "@cogno/core/workbench/bus/tab-list/events";
import {
  BlurTerminalAction,
  FocusTerminalAction,
  TerminalRemovedAction,
  WriteRawToPtyAction,
} from "@cogno/core/workbench/bus/terminal/actions";
import {
  TerminalSearchRequestedEvent,
  TerminalSearchRevealRequestedEvent,
} from "@cogno/core/workbench/bus/terminal/events";

export type AppMessage =
  | BusyIndicatorRegisterEvent
  | BusyIndicatorUnregisterEvent
  | BusyIndicatorClearForTerminalEvent
  | TabRemovedEvent
  | RemoveTabAction
  | CreateTabAction
  | TabAddedEvent
  | TabSelectedEvent
  | SelectTabAction
  | ConfigLoadedEvent
  | DBInitializedEvent
  | InitConfigAction
  | TerminalSearchRequestedEvent
  | TerminalSearchRevealRequestedEvent
  | FocusTerminalAction
  | BlurTerminalAction
  | WriteRawToPtyAction
  | ActionFiredEvent
  | TerminalRemovedAction
  | FocusActiveTerminalAction
  | NotificationEvent
  | OpenNotificationTargetAction
  | SideMenuEvent
  | ChangeTabTitleEvent
  | PaneMaximizedChangedEvent
  | VisibleTerminalsChangedEvent
  | TerminalIpcMessageEvent;
