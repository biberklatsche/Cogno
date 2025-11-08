import {ActionBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";

export type SelectTabAction = ActionBase<"SelectTab", TabId>
export type RemoveTabAction = ActionBase<"RemoveTab", TabId>
