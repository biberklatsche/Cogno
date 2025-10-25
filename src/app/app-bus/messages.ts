// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {LoadConfigCommand, WatchConfigCommand} from "../config/+bus/commands";
import {WorkspaceLoadedEvent} from "../workspace/+bus/events";
import {TabAddedEvent, TabRemovedEvent, TabSelectedEvent} from "../tab-list/+bus/events";
import {FocusTerminalCommand} from "../terminal/+bus/commands";
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
    | LoadConfigCommand
    | WatchConfigCommand
    | PtyInitializedEvent
    | TabTitleChangedEvent
    | TerminalThemeChangedEvent
    | FocusTerminalCommand;
