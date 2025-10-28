// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {LoadConfigAction, WatchConfigAction} from "../config/+bus/actions";
import {WorkspaceLoadedEvent} from "../workspace/+bus/events";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {FocusTerminalAction} from "../terminal/+bus/actions";
import {PtyInitializedEvent} from "../terminal/+bus/events";
import {TabTitleChangedEvent} from "../terminal/+state/handler/tab-title.handler";
import {TerminalThemeChangedEvent} from "../terminal/+state/handler/theme.handler";

export type AppMessage =
    | TabRemovedEvent
    | TabAddedEvent
    | TabSelectedEvent
    | WorkspaceLoadedEvent
    | ConfigLoadedEvent
    | ThemeChangedEvent
    | LoadConfigAction
    | WatchConfigAction
    | PtyInitializedEvent
    | TabTitleChangedEvent
    | TerminalThemeChangedEvent
    | FocusTerminalAction;
