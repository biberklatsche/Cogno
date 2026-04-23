import { ActionFiredEvent } from "../action/action.models";
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
import { ChangeTabTitleEvent, PaneMaximizedChangedEvent } from "../grid-list/+bus/events";
import { SideMenuEvent } from "../menu/side-menu/+bus/events";
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
  | SideMenuEvent
  | ChangeTabTitleEvent
  | PaneMaximizedChangedEvent;
