import {Injectable, Signal, signal, Type, WritableSignal} from "@angular/core";
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
    // Optional component to render in the side "aside" area when this item is active
    component: Type<any>;
};

@Injectable({providedIn: 'root'})
export class SideMenuService {

    private _menuItems: WritableSignal<SideMenuItem[]>  = signal<SideMenuItem[]>([]);
    private _selectedItem: WritableSignal<SideMenuItem | undefined> = signal<SideMenuItem | undefined>(undefined);

    constructor() {
    }

    get menu(): Signal<SideMenuItem[]> {
        return this._menuItems.asReadonly();
    }

    get selectedItem(): Signal<SideMenuItem | undefined> {
        return this._selectedItem.asReadonly();
    }

    addMenuItem(item: SideMenuItem): void {
        this._menuItems.update(s => [...s, item]);
    }

    toggle(item: SideMenuItem): void {
        const current = this._selectedItem();
        this._selectedItem.set(current === item ? undefined : item);
    }
}
