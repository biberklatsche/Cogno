import { MessageBase } from "../../app-bus/app-bus";

export type ConfigLoadedEvent = MessageBase<"ConfigLoaded", void>;
export type DBInitializedEvent = MessageBase<"DBInitialized", void>;
export type ThemeChangedEvent = MessageBase<"ThemeChanged", void>;
