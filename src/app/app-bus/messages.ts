import {ConfigLoadedEvent, DBInitializedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {InitConfigAction} from "../config/+bus/actions";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {
    BlurTerminalAction, ClearBufferAction, ClearLineAction,
    ClearLineToEndAction, ClearLineToStartAction, DeletePreviousWordAction,
    DeleteNextWordAction, GoToNextWordAction, GoToPreviousWordAction,
    SelectTextRightAction, SelectTextLeftAction, SelectWordRightAction,
    SelectWordLeftAction, SelectTextToEndOfLineAction, SelectTextToStartOfLineAction,
    CopyAction, FocusTerminalAction, PasteAction, TerminalRemovedAction,
} from '../terminal/+bus/actions';
import {PtyInitializedEvent} from "../terminal/+bus/events";
import {TerminalTitleChangedEvent} from "../terminal/+state/handler/terminal-title.handler";
import {
    TerminalThemeChangedEvent,
    TerminalThemePaddingAddedEvent,
    TerminalThemePaddingRemovedEvent
} from "../terminal/+state/handler/theme.handler";
import {RemoveTabAction, SelectTabAction} from "../tab-list/+bus/actions";
import {FullScreenAppEnteredEvent, FullScreenAppLeavedEvent} from "../terminal/+state/handler/full-screen-app.handler";
import {TerminalBlurredEvent, TerminalFocusedEvent} from "../terminal/+state/handler/focus.handler";
import {
    FocusActiveTerminalAction,
    RemovePaneAction, SplitPaneDownAction,
    SplitPaneLeftAction,
    SplitPaneRightAction,
    SplitPaneUpAction
} from "../grid-list/+bus/actions";
import {InspectorEvent} from "../inspector/+bus/events";
import {ActionFiredEvent} from "../action/action.models";
import {NotificationEvent} from "../notification/+bus/events";
import {SideMenuEvent} from "../menu/side-menu/+bus/events";
import {TabTitleChangedEvent} from "../grid-list/+bus/events";

export type TerminalCommandType = AppMessage['type']

export type AppMessage =
    | TabRemovedEvent
    | RemoveTabAction
    | TabAddedEvent
    | TabSelectedEvent
    | SelectTabAction
    | ConfigLoadedEvent
    | DBInitializedEvent
    | ThemeChangedEvent
    | InitConfigAction
    | PtyInitializedEvent
    | TerminalTitleChangedEvent
    | TerminalThemeChangedEvent
    | TerminalThemePaddingAddedEvent
    | TerminalThemePaddingRemovedEvent
    | FocusTerminalAction
    | BlurTerminalAction
    | PasteAction
    | CopyAction
    | ClearLineAction
    | ClearLineToEndAction
    | ClearLineToStartAction
    | DeletePreviousWordAction
    | DeleteNextWordAction
    | GoToNextWordAction
    | GoToPreviousWordAction
    | SelectTextRightAction
    | SelectTextLeftAction
    | SelectWordRightAction
    | SelectWordLeftAction
    | SelectTextToEndOfLineAction
    | SelectTextToStartOfLineAction
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
    | ClearBufferAction
    | FocusActiveTerminalAction
    | InspectorEvent
    | NotificationEvent
    | SideMenuEvent
    | TabTitleChangedEvent
    ;
