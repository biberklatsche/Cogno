import {ActionBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";

export type SelectTabCommand = ActionBase<"SelectTab", TabId>
