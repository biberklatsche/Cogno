// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, ThemeChangedEvent} from "../config/+bus/events";
import {LoadConfigCommand, WatchConfigCommand} from "../config/+bus/commands";
import {WorkspaceLoadedEvent} from "../workspace/+bus/events";

export type AppMessage =
    | WorkspaceLoadedEvent
    | ConfigLoadedEvent
    | ThemeChangedEvent
    | LoadConfigCommand
    | WatchConfigCommand;
