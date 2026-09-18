import { MessageBase } from "@cogno/core/workbench/bus/app-bus";

export type ConfigLoadedEvent = MessageBase<"ConfigLoaded", void>;
export type DBInitializedEvent = MessageBase<"DBInitialized", void>;
