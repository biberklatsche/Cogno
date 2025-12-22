import {Injectable, Signal, signal, Type, WritableSignal} from "@angular/core";
import {ActionName} from "../../../action/action.models";
import {Icon} from "../../../icons/+model/icon";
import {KeybindService} from "../../../keybinding/keybind.service";

export type SideMenuItem = {
    // Regular action item
    label: string;
    icon: Icon;
    hidden: boolean;
    pinned: boolean;
    actionName: ActionName;
    separator?: boolean;
    // Optional component to render in the side "aside" area when this item is active
    component: Type<any>;
};

@Injectable({providedIn: 'root'})
export class SideMenuService {

    private readonly listenerId = 'SideMenuEscListener';
    private _menuItems: WritableSignal<SideMenuItem[]> = signal<SideMenuItem[]>([]);
    private _selectedItem: WritableSignal<SideMenuItem | undefined> = signal<SideMenuItem | undefined>(undefined);
    private _displacement: WritableSignal<boolean> = signal<boolean>(false);
    private _pinnedStack: string[] = [];

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
                if (index > -1) {
                    s[index] = {...s[index], ...item};
                    return [...s];
                }
                return [...s, item]
            }
        );
    }

    removeMenuItem(label: string) {
        this._menuItems.update(s => {
                const index = s.findIndex(s => s.label === label);
                if (index === -1) {
                    return s;
                }
                s.splice(index, 1);
                return [...s]
            }
        );
    }

    open(label: string): void {
        const current = this._selectedItem();
        if (current?.label === label) return;
        const item = this._menuItems().find(s => s.label === label);
        this.keybindService.unregisterListener(this.listenerId);
        this.keybindService.registerListener(this.listenerId, ['Escape'], (event: KeyboardEvent) => this.close());
        this._selectedItem.set(item);
    }

    close() {
        const current = this._selectedItem();
        if(!current) return;
        this._selectedItem.set(undefined);
        this.keybindService.unregisterListener(this.listenerId);
        const item = this._menuItems().find(s => s.label === current.label);
        item!.pinned = false;
        const index = this._pinnedStack.findIndex(label => label === current.label);
        if(index > -1) {
            this._pinnedStack.splice(index, 1);
        }
        if(this._pinnedStack.length > 0) {
            const pinnedItemLabel = this._pinnedStack[this._pinnedStack.length - 1];
            this.open(pinnedItemLabel);
        }
    }

    toggleDisplacement() {
        this._displacement.update(s => !s);
    }

    togglePin() {
        const current = this._selectedItem();
        if (!current) return;
        current.pinned = !current?.pinned;
        this._selectedItem.set(current);
        const item = this._menuItems().find(s => s.label === current.label);
        item!.pinned = current.pinned;
        const index = this._pinnedStack.findIndex(label => label == current.label);
        if(current.pinned && index > -1) {
            return;
        }
        if(current.pinned && index <= -1) {
            this._pinnedStack.push(current.label);
            return;
        }
        if(!current.pinned && index > -1) {
            this._pinnedStack.splice(index, 1);
            return;
        }
        if(!current.pinned && index <= -1) {
            return;
        }
    }
}
