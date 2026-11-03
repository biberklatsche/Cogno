import { TerminalId } from "@cogno/shared/domain";
import { StackId, TabId, WorkspaceId } from "./grid-layout";

export const IdCreator = {
  newId(prefix = "ID"): string {
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  },

  newTabId(): TabId {
    return this.newId("TB");
  },

  newStackId(): StackId {
    return this.newId("TS");
  },

  newTerminalId(): TerminalId {
    return this.newId("TE");
  },

  newWorkspaceId(): WorkspaceId {
    return this.newId("WS");
  },
};
