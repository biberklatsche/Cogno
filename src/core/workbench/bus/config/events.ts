import { MessageBase } from "@cogno/core/workbench/bus/message-base";

export type ConfigLoadedEvent = MessageBase<"ConfigLoaded", void>;
export type DBInitializedEvent = MessageBase<"DBInitialized", void>;
