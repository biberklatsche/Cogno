import {TabId} from "../../core-host/workspace-model";
import {TerminalId} from "../../grid-list/+model/model";

export const IdCreator = {
    newTabId(): TabId {
        return 'TB' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },

    newTerminalId(): TerminalId {
        return 'TE' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },

    newWorkspaceId(): TerminalId {
        return 'WS' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

}
