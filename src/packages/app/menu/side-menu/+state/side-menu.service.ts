import { Injectable, Signal, signal, Type, WritableSignal } from "@angular/core";
import { Icon } from "@cogno/core-ui";
import { ActionName } from "../../../action/action.models";
import { AppBus } from "../../../app-bus/app-bus";

export type SideMenuItem = {
  id?: string;
  // Regular action item
  label: string;
  icon: Icon;
  order?: number;
  hidden: boolean;
  pinned: boolean;
  actionName: ActionName;
  separator?: boolean;
  // Optional component to render in the side "aside" area when this item is active
  component: Type<unknown>;
  // Optional badge color indicator
  badgeColor?: string;
};

@Injectable({ providedIn: "root" })
export class SideMenuService {
  private static readonly defaultPanelWidthInPixels = 360;
  private static readonly minimumPanelWidthInPixels = 280;
  private static readonly maximumPanelWidthInPixels = 640;

  private _menuItems: WritableSignal<SideMenuItem[]> = signal<SideMenuItem[]>([]);
  private _selectedItem: WritableSignal<SideMenuItem | undefined> = signal<
    SideMenuItem | undefined
  >(undefined);
  private _displacement: WritableSignal<boolean> = signal<boolean>(false);
  private _isFocused: WritableSignal<boolean> = signal<boolean>(false);
  private _panelWidthInPixels: WritableSignal<number> = signal<number>(
    SideMenuService.defaultPanelWidthInPixels,
  );
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

  get isFocused(): Signal<boolean> {
    return this._isFocused.asReadonly();
  }

  get panelWidthInPixels(): Signal<number> {
    return this._panelWidthInPixels.asReadonly();
  }

  constructor(private bus: AppBus) {}

  addMenuItem(item: SideMenuItem): void {
    this._menuItems.update((s) => {
      const index = s.findIndex((s) => s.label === item.label);
      if (index > -1) {
        s[index] = { ...s[index], ...item };
        return [...s];
      }
      return [...s, item];
    });
  }

  removeMenuItem(label: string) {
    this._menuItems.update((s) => {
      const index = s.findIndex((s) => s.label === label);
      if (index === -1) {
        return s;
      }
      s.splice(index, 1);
      return [...s];
    });
  }

  isSelected(label: string): boolean {
    return this._selectedItem()?.label === label;
  }

  open(label: string): void {
    const current = this._selectedItem();
    if (current?.label === label) {
      this.focus();
      return;
    }

    if (current) {
      this.bus.publish({ type: "SideMenuViewClosed", payload: { label: current.label } });
    }

    const item = this._menuItems().find((s) => s.label === label);
    this._selectedItem.set(item);

    if (item) {
      this.bus.publish({ type: "SideMenuViewOpened", payload: { label: item.label } });
      this.focus();
    } else {
      this.blur();
    }
  }

  close(force = false) {
    const current = this._selectedItem();
    if (!current) return;
    if (current.pinned && !force) {
      this.blur();
      this.bus.publish({ type: "FocusActiveTerminal", path: ["app", "terminal"] });
      return;
    }

    this.bus.publish({ type: "SideMenuViewClosed", payload: { label: current.label } });

    this.blur();
    this._selectedItem.set(undefined);

    // Update the item in the menu list to be unpinned
    this._menuItems.update((items) =>
      items.map((item) => (item.label === current.label ? { ...item, pinned: false } : item)),
    );

    const index = this._pinnedStack.indexOf(current.label);
    if (index > -1) {
      this._pinnedStack.splice(index, 1);
    }
    if (this._pinnedStack.length > 0) {
      const pinnedItemLabel = this._pinnedStack[this._pinnedStack.length - 1];
      this.open(pinnedItemLabel);
    }
    this.bus.publish({ type: "FocusActiveTerminal", path: ["app", "terminal"] });
  }

  focus() {
    const current = this._selectedItem();
    if (!current || this._isFocused()) return;

    this._isFocused.set(true);
    this.bus.publish({ type: "SideMenuViewFocused", payload: { label: current.label } });
  }

  blur() {
    const current = this._selectedItem();
    if (!current || !this._isFocused()) return;

    this._isFocused.set(false);
    this.bus.publish({ type: "SideMenuViewBlurred", payload: { label: current.label } });
  }

  toggleDisplacement() {
    this._displacement.update((s) => !s);
  }

  togglePin() {
    const current = this._selectedItem();
    if (!current) return;
    const newPinned = !current.pinned;

    // Update the item in the menu list
    this._menuItems.update((items) =>
      items.map((item) => (item.label === current.label ? { ...item, pinned: newPinned } : item)),
    );

    // Update selected item with a new object reference to trigger signals/effects
    this._selectedItem.set({ ...current, pinned: newPinned });

    const index = this._pinnedStack.indexOf(current.label);
    if (newPinned && index === -1) {
      this._pinnedStack.push(current.label);
    } else if (!newPinned && index > -1) {
      this._pinnedStack.splice(index, 1);
    }
  }

  updateIcon(label: string, icon: Icon) {
    this._menuItems.update((s) => s.map((i) => (i.label === label ? { ...i, icon } : i)));
    this._selectedItem.update((s) => (s?.label === label ? { ...s, icon } : s));
  }

  updateBadgeColor(label: string, color?: string) {
    this._menuItems.update((s) =>
      s.map((i) => (i.label === label ? { ...i, badgeColor: color } : i)),
    );
    this._selectedItem.update((s) => (s?.label === label ? { ...s, badgeColor: color } : s));
  }

  setPanelWidthInPixels(panelWidthInPixels: number): void {
    this._panelWidthInPixels.set(this.clampPanelWidthInPixels(panelWidthInPixels));
  }

  private clampPanelWidthInPixels(panelWidthInPixels: number): number {
    return Math.max(
      SideMenuService.minimumPanelWidthInPixels,
      Math.min(SideMenuService.maximumPanelWidthInPixels, Math.round(panelWidthInPixels)),
    );
  }
}
