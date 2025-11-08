import {MessageBase} from "../../app-bus/app-bus";

export type InspectorDataType = 'keybind';
export type InspectorEvent = MessageBase<"Inspector", {type: InspectorDataType, data: any}>
