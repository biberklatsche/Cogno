import {MessageBase} from "../../app-bus/app-bus";
import {TabId} from "../../workspace/+model/workspace";

export type AddGridCommand = MessageBase<"AddGridCommand", TabId>
