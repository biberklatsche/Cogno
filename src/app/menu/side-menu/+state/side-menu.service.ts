import {Injectable, Signal, signal, WritableSignal} from "@angular/core";
import {ActionName} from "../../../action/action.models";
import {Icon} from "../../../icons/+model/icon";

export type SideMenuItem = {
    // Regular action item
    label?: string;
    icon?: Icon;
    actionName?: ActionName;
    action?: (arg?: any) => void;
    disabled?: boolean;
    separator?: boolean;
};

@Injectable({providedIn: 'root'})
export class SideMenuService {

    private _menuItems: WritableSignal<SideMenuItem[]>  = signal<SideMenuItem[]>([]);

    constructor() {
    }

    get menu(): Signal<SideMenuItem[]> {
        return this._menuItems.asReadonly();
    }

    addMenuItem(item: SideMenuItem): void {
        this._menuItems.update(s => [...s, item]);
    }
}
