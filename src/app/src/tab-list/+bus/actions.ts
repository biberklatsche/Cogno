import {ActionBase} from "../../app-bus/app-bus";
import {TabId} from "@cogno/core-sdk";

export type SelectTabAction = ActionBase<"SelectTab", TabId>
export type RemoveTabAction = ActionBase<"RemoveTab", TabId>
export type CreateTabAction = ActionBase<"CreateTab", { tabId: TabId; title?: string; isActive?: boolean }>
