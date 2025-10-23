import {TabId} from "../../workspace/+model/workspace";
import {TerminalId} from "../../grid-list/+model/model";

export const IdCreator = {
    newTabId(): TabId {
        return 'Tab' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    },

    newTerminalId(): TerminalId {
        return 'Terminal' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

}
