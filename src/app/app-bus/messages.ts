// Deine fachlichen Typen in einem Union:
import {ConfigLoadedEvent, LoadConfigCommand, ThemeChangedEvent, WatchConfigCommand} from "../config/+bus/events";

export type AppMessage =
    | ConfigLoadedEvent
    | ThemeChangedEvent
    | LoadConfigCommand
    | WatchConfigCommand;
