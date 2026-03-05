import {ConfigLoadedEvent, DBInitializedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {InitConfigAction} from "../config/+bus/actions";
import {TabAddedEvent, TabRemovedEvent, TabRenamedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {
    ApplyAutocompleteSuggestionAction,
    BlurTerminalAction, ClearBufferAction, ClearLineAction,
    ClearLineToEndAction, ClearLineToStartAction, DeletePreviousWordAction,
    DeleteNextWordAction, GoToNextWordAction, GoToPreviousWordAction,
    InjectTerminalInputAction,
    SelectTextRightAction, SelectTextLeftAction, SelectWordRightAction,
    SelectWordLeftAction, SelectTextToEndOfLineAction, SelectTextToStartOfLineAction,
    CopyAction, FocusTerminalAction, PasteAction, TerminalRemovedAction, CutAction, SelectAllAction,
} from '../terminal/+bus/actions';
import {
    PtyInitializedEvent,
    TerminalCwdChangedEvent,
    TerminalSearchRevealRequestedEvent,
    TerminalSearchRequestedEvent,
    TerminalSearchResultEvent,
    TerminalTitleChangedEvent
} from "../terminal/+bus/events";
import {
    TerminalThemeChangedEvent,
    TerminalThemePaddingAddedEvent,
    TerminalThemePaddingRemovedEvent
} from "../terminal/+state/handler/theme.handler";
import {CreateTabAction, RemoveTabAction, SelectTabAction} from "../tab-list/+bus/actions";
import {FullScreenAppEnteredEvent, FullScreenAppLeavedEvent} from "../terminal/+state/handler/full-screen-app.handler";
import {TerminalBlurredEvent, TerminalFocusedEvent} from "../terminal/+state/handler/focus.handler";
import {
    FocusActiveTerminalAction,
    MaximizePaneAction,
    MinimizePaneAction,
    RemovePaneAction, SplitPaneDownAction,
    SelectNextPaneAction,
    SelectPreviousPaneAction,
    SplitPaneLeftAction,
    SplitPaneRightAction,
    SplitPaneUpAction
} from "../grid-list/+bus/actions";
import {ActionFiredEvent} from "../action/action.models";
import {NotificationEvent} from "../notification/+bus/events";
import {SideMenuEvent} from "../menu/side-menu/+bus/events";
import {PaneMaximizedChangedEvent, TabTitleChangedEvent} from "../grid-list/+bus/events";

export type TerminalCommandType = AppMessage['type']

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
    | TerminalCwdChangedEvent
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
    | TabTitleChangedEvent
    | PaneMaximizedChangedEvent
    ;
