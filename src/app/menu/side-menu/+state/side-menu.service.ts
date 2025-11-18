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
    private _pinned: WritableSignal<boolean> = signal<boolean>(false);
    private _displacement: WritableSignal<boolean> = signal<boolean>(false);

    get menu(): Signal<SideMenuItem[]> {
        return this._menuItems.asReadonly();
    }

    get selectedItem(): Signal<SideMenuItem | undefined> {
        return this._selectedItem.asReadonly();
    }

    get pinned(): Signal<boolean> {
        return this._pinned.asReadonly();
    }

    get displacement(): Signal<boolean> {
        return this._displacement.asReadonly();
    }

    addMenuItem(item: SideMenuItem): void {
        this._menuItems.update(s => {
            if(s.find(s => s.label === item.label)) {return s;}
            return [...s, item]}
        );
    }

    toggle(item: SideMenuItem): void {
        const current = this._selectedItem();
        this._selectedItem.set(current === item ? undefined : item);
    }

    togglePin() {
        this._pinned.update(s => !s);
    }

    toggleDisplacement() {
        this._displacement.update(s => !s);
    }
}
