import {ActionBase} from "../../app-bus/app-bus";
import {TabId} from "@cogno/core-api";

export type SelectTabAction = ActionBase<"SelectTab", TabId>
export type RemoveTabAction = ActionBase<"RemoveTab", TabId>
export type CreateTabAction = ActionBase<"CreateTab", { tabId: TabId; title?: string; isActive?: boolean; shellName?: string; workingDir?: string }>



