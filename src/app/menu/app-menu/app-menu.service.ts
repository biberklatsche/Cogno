import {DestroyRef, Injectable} from '@angular/core';
import {ConfigService} from "../../config/+state/config.service";
import {ActionName} from "../../config/+models/config.types";
import {KeybindService} from "../../keybinding/keybind.service";
import {AppBus} from "../../app-bus/app-bus";
import {ContextMenuItem} from "../../common/menu-overlay/menu-overlay.types";


@Injectable({
    providedIn: 'root'
})
export class AppMenuService {


    constructor(private bus: AppBus, private keybindService: KeybindService, configService: ConfigService, ref: DestroyRef) {

    }

    public buildMenu(): ContextMenuItem[] {
        return [
            this.buildMenuItem('new_window', 'New Window')
        ];
    }

    private buildMenuItem(actionName: ActionName, text: string): ContextMenuItem {
        return { label: text, action: () => {
                const actionDef = this.keybindService.getActionDefinition(actionName);
                if(!actionDef) throw new Error(`Action definition ${actionName} not found.`);
                this.bus.publish({
                    type: 'KeybindFired',
                    payload: actionDef.actionName,
                    trigger: actionDef.trigger,
                    args: actionDef.args,
                    path: ['app', 'keybind']
                });
            }, actionName: actionName  };
    }
}


