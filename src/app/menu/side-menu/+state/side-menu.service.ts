import {Injectable, Signal, signal, Type, WritableSignal} from "@angular/core";
import {ActionName} from "../../../action/action.models";
import {Icon} from "../../../icons/+model/icon";

export type SideMenuItem = {
    // Regular action item
    label: string;
    icon: Icon;
    hidden: boolean;
    actionName: ActionName;
    separator?: boolean;
    // Optional component to render in the side "aside" area when this item is active
    component: Type<any>;
};

@Injectable({providedIn: 'root'})
export class SideMenuService {

    private _menuItems: WritableSignal<SideMenuItem[]>  = signal<SideMenuItem[]>([]);
    private _selectedItem: WritableSignal<SideMenuItem | undefined> = signal<SideMenuItem | undefined>(undefined);
    private _displacement: WritableSignal<boolean> = signal<boolean>(false);

    get menu(): Signal<SideMenuItem[]> {
        return this._menuItems.asReadonly();
    }

    get selectedItem(): Signal<SideMenuItem | undefined> {
        return this._selectedItem.asReadonly();
    }

    get displacement(): Signal<boolean> {
        return this._displacement.asReadonly();
    }

    addMenuItem(item: SideMenuItem): void {
        this._menuItems.update(s => {
            const index = s.findIndex(s => s.label === item.label);
            if(index > -1) {
                s[index] = {...s[index], ...item};
                return [...s];
            }
            return [...s, item]}
        );
    }

    removeMenuItem(label: string) {
        this._menuItems.update(s => {
            const index = s.findIndex(s => s.label === label);
            if(index === -1) {return s;}
            s.splice(index, 1);
            return [...s]}
        );
    }

    toggle(label: string): void {
        const current = this._selectedItem();
        const item = this._menuItems().find(s => s.label === label);
        this._selectedItem.set(current?.label === label ? undefined : item);
    }

    close() {
        this._selectedItem.set(undefined);
    }

    toggleDisplacement() {
        this._displacement.update(s => !s);
    }
}
