// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {LoadConfigAction, WatchConfigAction} from "../config/+bus/actions";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {
    BlurTerminalAction, ClearBufferAction, CopyAction,
    FocusTerminalAction, PasteAction, TerminalRemovedAction,
} from "../terminal/+bus/actions";
import {PtyInitializedEvent} from "../terminal/+bus/events";
import {TabTitleChangedEvent} from "../terminal/+state/handler/tab-title.handler";
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

export type AppMessage =
    | TabRemovedEvent
    | RemoveTabAction
    | TabAddedEvent
    | TabSelectedEvent
    | SelectTabAction
    | ConfigLoadedEvent
    | ThemeChangedEvent
    | LoadConfigAction
    | WatchConfigAction
    | PtyInitializedEvent
    | TabTitleChangedEvent
    | TerminalThemeChangedEvent
    | TerminalThemePaddingAddedEvent
    | TerminalThemePaddingRemovedEvent
    | FocusTerminalAction
    | BlurTerminalAction
    | PasteAction
    | CopyAction
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
    ;
