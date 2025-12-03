import {Injectable, Signal, signal, Type, WritableSignal} from "@angular/core";
import {ActionName} from "../../../action/action.models";
import {Icon} from "../../../icons/+model/icon";
import {KeybindService} from "../../../keybinding/keybind.service";

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

    private readonly listenerId = 'SideMenuEscListener';
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

    constructor(private keybindService: KeybindService) {
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
        const openItem = current?.label !== label;
        if(openItem) {
            this.open(label);
        } else {
            this.close();
        }

    }

    open(label: string): void {
        const current = this._selectedItem();
        if(current?.label === label) return;
        const item = this._menuItems().find(s => s.label === label);
        this.keybindService.registerListener(this.listenerId, ['Escape'], (event: KeyboardEvent) => this.close());
        this._selectedItem.set(item);
    }

    close() {
        this._selectedItem.set(undefined);
        this.keybindService.unregisterListener(this.listenerId);
    }

    toggleDisplacement() {
        this._displacement.update(s => !s);
    }
}
