import {MessageBase} from "../../app-bus/app-bus";

export type LoadConfigCommand = MessageBase<"LoadConfigCommand", void>
export type WatchConfigCommand = MessageBase<"WatchConfigCommand", void>
