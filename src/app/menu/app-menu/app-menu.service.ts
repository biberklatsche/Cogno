import {DestroyRef, Injectable} from '@angular/core';
import {ConfigService} from "../../config/+state/config.service";
import {KeybindService} from "../../keybinding/keybind.service";
import {AppBus} from "../../app-bus/app-bus";
import {ContextMenuItem} from "../../common/context-menu-overlay/context-menu-overlay.types";
import {ActionFired, ActionName} from "../../action/action.models";


@Injectable({
    providedIn: 'root'
})
export class AppMenuService {


    constructor(private bus: AppBus, private keybindService: KeybindService, configService: ConfigService, ref: DestroyRef) {

    }

    public buildMenu(): ContextMenuItem[] {
        return [
            this.buildMenuItem('new_window', 'New Window'),
            { separator: true },
            this.buildMenuItem('open_config', 'Settings...')
        ];
    }

    private buildMenuItem(actionName: ActionName, text: string): ContextMenuItem {
        return { label: text, action: () => {
                const actionDef = this.keybindService.getActionDefinition(actionName);
                if(!actionDef) throw new Error(`Action definition ${actionName} not found.`);
                this.bus.publish(ActionFired.create(
                    actionDef.actionName,
                    actionDef.trigger,
                    actionDef.args,
                ));
            }, actionName: actionName  };
    }
}


