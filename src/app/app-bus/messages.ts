// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {LoadConfigAction, WatchConfigAction} from "../config/+bus/actions";
import {WorkspaceLoadedEvent} from "../workspace/+bus/events";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {
    BlurTerminalAction,
    ClearBufferAction,
    CopyAction,
    FocusTerminalAction,
    PasteAction
} from "../terminal/+bus/actions";
import {PtyInitializedEvent} from "../terminal/+bus/events";
import {TabTitleChangedEvent} from "../terminal/+state/handler/tab-title.handler";
import {
    TerminalThemeChangedEvent,
    TerminalThemePaddingAddedEvent,
    TerminalThemePaddingRemovedEvent
} from "../terminal/+state/handler/theme.handler";
import {RemoveTabAction, SelectTabAction} from "../tab-list/+bus/actions";
import {KeybindFiredEvent} from "../keybinding/keybind.service";
import {FullScreenAppEnteredEvent, FullScreenAppLeavedEvent} from "../terminal/+state/handler/full-screen-app.handler";
import {TerminalBlurredEvent, TerminalFocusedEvent} from "../terminal/+state/handler/focus.handler";
import {
    RemovePaneAction, SplitPaneDownAction,
    SplitPaneLeftAction,
    SplitPaneRightAction,
    SplitPaneUpAction
} from "../grid-list/+bus/actions";

export type AppMessage =
    | TabRemovedEvent
    | RemoveTabAction
    | TabAddedEvent
    | TabSelectedEvent
    | SelectTabAction
    | WorkspaceLoadedEvent
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
    | KeybindFiredEvent
    | FullScreenAppEnteredEvent
    | FullScreenAppLeavedEvent
    | TerminalFocusedEvent
    | TerminalBlurredEvent
    | RemovePaneAction
    | SplitPaneRightAction
    | SplitPaneLeftAction
    | SplitPaneUpAction
    | SplitPaneDownAction
    | ClearBufferAction
    ;
