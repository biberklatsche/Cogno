import { TabId, WorkspaceId } from "@cogno/core-api";
import { TerminalId } from "../../grid-list/+model/model";

export const IdCreator = {
  newId(prefix = "ID"): string {
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  },

  newTabId(): TabId {
    return this.newId("TB");
  },

  newTerminalId(): TerminalId {
    return this.newId("TE");
  },

  newWorkspaceId(): WorkspaceId {
    return this.newId("WS");
  },
};
