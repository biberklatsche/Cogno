import { ActionFiredEvent } from "../action/action.models";
import { TerminalIpcMessageEvent } from "../cogno-message/+bus/events";
import {
  BusyIndicatorClearForTerminalEvent,
  BusyIndicatorRegisterEvent,
  BusyIndicatorUnregisterEvent,
} from "../common/busy-indicator/+bus/events";
import { InitConfigAction } from "../config/+bus/actions";
import { ConfigLoadedEvent, DBInitializedEvent, ThemeChangedEvent } from "../config/+bus/events";
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
} from "../grid-list/+bus/actions";
import {
  ChangeTabTitleEvent,
  PaneMaximizedChangedEvent,
  VisibleTerminalsChangedEvent,
} from "../grid-list/+bus/events";
import { SideMenuEvent } from "../menu/side-menu/+bus/events";
import { OpenNotificationTargetAction } from "../notification/+bus/actions";
import { NotificationEvent } from "../notification/+bus/events";
import { CreateTabAction, RemoveTabAction, SelectTabAction } from "../tab-list/+bus/actions";
import {
  TabAddedEvent,
  TabRemovedEvent,
  TabRenamedEvent,
  TabSelectedEvent,
} from "../tab-list/+bus/events";
import {
  ApplyAutocompleteSuggestionAction,
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
  InjectTerminalInputAction,
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
} from "../terminal/+bus/actions";
import {
  PtyInitializedEvent,
  TerminalBusyChangedEvent,
  TerminalCursorRestoreRequestedEvent,
  TerminalCwdChangedEvent,
  TerminalSearchPanelRequestedEvent,
  TerminalSearchRequestedEvent,
  TerminalSearchResultEvent,
  TerminalSearchRevealRequestedEvent,
  TerminalTitleChangedEvent,
} from "../terminal/+bus/events";
import {
  TerminalBlurredEvent,
  TerminalFocusedEvent,
} from "../terminal/+state/handler/focus.handler";
import {
  FullScreenAppEnteredEvent,
  FullScreenAppLeavedEvent,
} from "../terminal/+state/handler/full-screen-app.handler";
import {
  TerminalThemeChangedEvent,
  TerminalThemePaddingAddedEvent,
  TerminalThemePaddingRemovedEvent,
} from "../terminal/+state/handler/theme.handler";

export type TerminalCommandType = AppMessage["type"];

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
  | PtyInitializedEvent
  | TerminalBusyChangedEvent
  | TerminalCursorRestoreRequestedEvent
  | TerminalCwdChangedEvent
  | TerminalSearchPanelRequestedEvent
  | TerminalTitleChangedEvent
  | TerminalSearchRequestedEvent
  | TerminalSearchResultEvent
  | TerminalSearchRevealRequestedEvent
  | TerminalThemeChangedEvent
  | TerminalThemePaddingAddedEvent
  | TerminalThemePaddingRemovedEvent
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
  | InjectTerminalInputAction
  | ApplyAutocompleteSuggestionAction
  | ActionFiredEvent
  | FullScreenAppEnteredEvent
  | FullScreenAppLeavedEvent
  | TerminalFocusedEvent
  | TerminalBlurredEvent
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
