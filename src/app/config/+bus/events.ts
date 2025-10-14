import {MessageBase} from "../../app-bus/app-bus";


export type ConfigLoadedEvent = MessageBase<"ConfigLoaded", void>
export type ThemeChangedEvent = MessageBase<"ThemeChanged", void>

export type LoadConfigCommand = MessageBase<"LoadConfigCommand", void>
export type WatchConfigCommand = MessageBase<"WatchConfigCommand", void>
