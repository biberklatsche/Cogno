import {MessageBase} from "../../app-bus/app-bus";

export type InspectorDataType = 'keybind' | 'terminal-state' | 'terminal-history';
export type InspectorEvent = MessageBase<"Inspector", {type: InspectorDataType, data: any}>
