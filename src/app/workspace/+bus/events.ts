import {MessageBase} from "../../app-bus/app-bus";
import {WorkspaceConfig} from "../+model/workspace";

export type WorkspaceLoadedEvent = MessageBase<"WorkspaceLoaded", WorkspaceConfig>
