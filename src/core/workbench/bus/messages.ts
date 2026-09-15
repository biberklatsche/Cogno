import { ActionFiredEvent } from "@cogno/core/workbench/bus/action.models";
import {
  BusyIndicatorClearForTerminalEvent,
  BusyIndicatorRegisterEvent,
  BusyIndicatorUnregisterEvent,
} from "@cogno/core/workbench/bus/busy-indicator/events";
import { TerminalIpcMessageEvent } from "@cogno/core/workbench/bus/cogno-message/events";
import { InitConfigAction } from "@cogno/core/workbench/bus/config/actions";
import {
  ConfigLoadedEvent,
  DBInitializedEvent,
  ThemeChangedEvent,
} from "@cogno/core/workbench/bus/config/events";
import {
  FocusActiveTerminalAction,
  MaximizePaneAction,
  MinimizePaneAction,
  RemovePaneAction,
  SelectNextPaneAction,
  SelectPreviousPaneAction,
  SplitPaneDownAction,
  SplitPaneLeftAction,
  SplitPaneRightAction,
  SplitPaneUpAction,
} from "@cogno/core/workbench/bus/grid-list/actions";
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
  TabRenamedEvent,
  TabSelectedEvent,
} from "@cogno/core/workbench/bus/tab-list/events";
import {
  BlurTerminalAction,
  ClearBufferAction,
  ClearLineAction,
  ClearLineToEndAction,
  ClearLineToStartAction,
  CopyAction,
  CutAction,
  DeleteNextWordAction,
  DeletePreviousWordAction,
  FocusTerminalAction,
  GoToEndOfLineAction,
  GoToNextWordAction,
  GoToPreviousWordAction,
  GoToStartOfLineAction,
  PasteAction,
  RevealTerminalAction,
  SelectAllAction,
  SelectTextLeftAction,
  SelectTextRightAction,
  SelectTextToEndOfLineAction,
  SelectTextToStartOfLineAction,
  SelectWordLeftAction,
  SelectWordRightAction,
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
  | TabRenamedEvent
  | SelectTabAction
  | ConfigLoadedEvent
  | DBInitializedEvent
  | ThemeChangedEvent
  | InitConfigAction
  | TerminalSearchRequestedEvent
  | TerminalSearchRevealRequestedEvent
  | FocusTerminalAction
  | RevealTerminalAction
  | BlurTerminalAction
  | PasteAction
  | CopyAction
  | CutAction
  | ClearLineAction
  | ClearLineToEndAction
  | ClearLineToStartAction
  | DeletePreviousWordAction
  | DeleteNextWordAction
  | GoToNextWordAction
  | GoToPreviousWordAction
  | GoToStartOfLineAction
  | GoToEndOfLineAction
  | SelectAllAction
  | SelectTextRightAction
  | SelectTextLeftAction
  | SelectWordRightAction
  | SelectWordLeftAction
  | SelectTextToEndOfLineAction
  | SelectTextToStartOfLineAction
  | WriteRawToPtyAction
  | ActionFiredEvent
  | RemovePaneAction
  | TerminalRemovedAction
  | SplitPaneRightAction
  | SplitPaneLeftAction
  | SplitPaneUpAction
  | SplitPaneDownAction
  | SelectNextPaneAction
  | SelectPreviousPaneAction
  | MaximizePaneAction
  | MinimizePaneAction
  | ClearBufferAction
  | FocusActiveTerminalAction
  | NotificationEvent
  | OpenNotificationTargetAction
  | SideMenuEvent
  | ChangeTabTitleEvent
  | PaneMaximizedChangedEvent
  | VisibleTerminalsChangedEvent
  | TerminalIpcMessageEvent;
