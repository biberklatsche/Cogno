import {MessageBase} from "../../app-bus/app-bus";

export type InspectorDataType = 'keybind' | 'terminal-mouse-position' | 'terminal-dimensions';
export type InspectorEvent = MessageBase<"Inspector", {type: InspectorDataType, data: any}>
