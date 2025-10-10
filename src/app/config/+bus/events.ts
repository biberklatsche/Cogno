import {CommandBase, EventBase} from "../../event-bus/event-bus";

export type ConfigLoadedEvent = EventBase<"ConfigLoaded", void>
export type ThemeChangedEvent = EventBase<"ThemeChanged", void>

export type LoadConfigCommand = CommandBase<"LoadConfigCommand", void>
export type WatchConfigCommand = CommandBase<"WatchConfigCommand", void>
