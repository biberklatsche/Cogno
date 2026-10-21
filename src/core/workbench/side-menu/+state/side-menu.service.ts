import { computed, Injectable, Signal, signal, Type, WritableSignal } from "@angular/core";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { Icon } from "@cogno/shared/ui";

export type SideMenuItem = {
  id?: string;
  // Regular action item
  label: string;
  icon: Icon;
  order?: number;
  hidden: boolean;
  actionName: ActionName;
  separator?: boolean;
  // Optional component to render in the side "aside" area when this item is active
  component: Type<unknown> | null;
  // Optional badge color indicator
  badgeColor?: string;
};

@Injectable({ providedIn: "root" })
export class SideMenuService {
  private static readonly defaultPanelWidthInPixels = 360;
  private static readonly minimumPanelWidthInPixels = 280;

  private _menuItems: WritableSignal<SideMenuItem[]> = signal<SideMenuItem[]>([]);
  private _selectedItem: WritableSignal<SideMenuItem | undefined> = signal<
    SideMenuItem | undefined
  >(undefined);
  private _isFocused: WritableSignal<boolean> = signal<boolean>(false);
  /** Each panel's own width, by label; a panel without one has the default. */
  private _panelWidths: WritableSignal<ReadonlyMap<string, number>> = signal<
    ReadonlyMap<string, number>
  >(new Map());
  /**
   * Panels docked beside the terminals instead of floating over them; a docked
   * panel stays open until it is closed with X. Like expand, pinning belongs to
   * the panel and outlives both its being open and its menu item.
   */
  private _pinnedLabels: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(
    new Set(),
  );
  /** The pinned panels opened since they were last closed, the latest on top. */
  private _pinnedStack: string[] = [];
  /**
   * Panels that span the whole terminal area instead of their own width.
   * Expand belongs to the panel, not to its being open: a closed panel opens
   * expanded again, which is why this outlives the menu items.
   */
  private _expandedLabels: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(
    new Set(),
  );

  get menu(): Signal<SideMenuItem[]> {
    return this._menuItems.asReadonly();
  }

  get selectedItem(): Signal<SideMenuItem | undefined> {
    return this._selectedItem.asReadonly();
  }

  get isFocused(): Signal<boolean> {
    return this._isFocused.asReadonly();
  }

  get panelWidths(): Signal<ReadonlyMap<string, number>> {
    return this._panelWidths.asReadonly();
  }

  /** The open panel's width. */
  readonly panelWidthInPixels: Signal<number> = computed(() => {
    const current = this._selectedItem();
    return (
      (current && this._panelWidths().get(current.label)) ??
      SideMenuService.defaultPanelWidthInPixels
    );
  });

  get expandedLabels(): Signal<ReadonlySet<string>> {
    return this._expandedLabels.asReadonly();
  }

  get pinnedLabels(): Signal<ReadonlySet<string>> {
    return this._pinnedLabels.asReadonly();
  }

  /** Whether the open panel is pinned. */
  readonly isPinned: Signal<boolean> = computed(() => {
    const current = this._selectedItem();
    return !!current && this._pinnedLabels().has(current.label);
  });

  /** Whether the open panel is expanded. */
  readonly isExpanded: Signal<boolean> = computed(() => {
    const current = this._selectedItem();
    return !!current && this._expandedLabels().has(current.label);
  });

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

  resolveComponent(label: string, component: Type<unknown>): void {
    this._menuItems.update((items) =>
      items.map((item) => (item.label === label ? { ...item, component } : item)),
    );
    this._selectedItem.update((item) => (item?.label === label ? { ...item, component } : item));
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

  /**
   * Open a panel. `focusView` is false only when a panel is brought back as a
   * side effect (a pinned panel reappearing when a transient one closes): the
   * panel becomes visible but must not grab the keyboard, so focus can go where
   * the caller wants it (the terminal).
   */
  open(label: string, focusView = true): void {
    const current = this._selectedItem();
    if (current?.label === label) {
      if (focusView) this.focus();
      return;
    }

    if (current) {
      this.blur();
      this.bus.publish({ type: "SideMenuViewClosed", payload: { label: current.label } });
    }

    const item = this._menuItems().find((s) => s.label === label);
    this._selectedItem.set(item);

    // A panel closed while pinned keeps its pin, so opening it again puts it
    // back on the pinned stack.
    if (item && this._pinnedLabels().has(item.label) && !this._pinnedStack.includes(item.label)) {
      this._pinnedStack.push(item.label);
    }

    if (item) {
      this.bus.publish({ type: "SideMenuViewOpened", payload: { label: item.label } });
      if (focusView) this.focus();
    } else {
      this.blur();
    }
  }

  /**
   * A panel's shortcut: opens the panel, takes the keyboard to it when it is
   * open but unfocused, and closes it, as the X does, when it has the keyboard.
   */
  toggle(label: string): void {
    if (this.isSelected(label) && this._isFocused()) {
      this.close(true);
      return;
    }
    this.open(label);
  }

  close(force = false) {
    const current = this._selectedItem();
    if (!current) return;
    if (this._pinnedLabels().has(current.label) && !force) {
      this.blur();
      this.bus.publish({ type: "FocusActiveTerminal" });
      return;
    }

    this.bus.publish({ type: "SideMenuViewClosed", payload: { label: current.label } });

    this.blur();
    this._selectedItem.set(undefined);

    // A forced close hides a pinned panel but leaves it pinned; it only stops
    // coming back on its own until it is opened again.
    const index = this._pinnedStack.indexOf(current.label);
    if (index > -1) {
      this._pinnedStack.splice(index, 1);
    }
    if (this._pinnedStack.length > 0) {
      const pinnedItemLabel = this._pinnedStack[this._pinnedStack.length - 1];
      // Bring the pinned panel back visible, but do not let it take the
      // keyboard - the focus belongs to the terminal (below).
      this.open(pinnedItemLabel, false);
    }
    this.bus.publish({ type: "FocusActiveTerminal" });
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

  togglePin() {
    const current = this._selectedItem();
    if (!current) return;
    const newPinned = !this._pinnedLabels().has(current.label);
    this._pinnedLabels.update((labels) => {
      const next = new Set(labels);
      if (newPinned) next.add(current.label);
      else next.delete(current.label);
      return next;
    });

    const index = this._pinnedStack.indexOf(current.label);
    if (newPinned && index === -1) {
      this._pinnedStack.push(current.label);
    } else if (!newPinned && index > -1) {
      this._pinnedStack.splice(index, 1);
    }
  }

  toggleExpanded() {
    const current = this._selectedItem();
    if (!current) return;
    this._expandedLabels.update((labels) => {
      const next = new Set(labels);
      if (next.has(current.label)) next.delete(current.label);
      else next.add(current.label);
      return next;
    });
  }

  setExpandedLabels(labels: ReadonlyArray<string>): void {
    this._expandedLabels.set(new Set(labels));
  }

  setPinnedLabels(labels: ReadonlyArray<string>): void {
    this._pinnedLabels.set(new Set(labels));
  }

  /**
   * The panel to bring back after a restart: the pinned one in view, or the
   * one a floating panel lies over. A floating panel is a quick look and is not
   * brought back.
   */
  dockedPanelLabel(): string | null {
    if (this.isPinned()) return this._selectedItem()?.label ?? null;
    return this._pinnedStack.at(-1) ?? null;
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

  /** Sets the open panel's width. */
  setPanelWidthInPixels(panelWidthInPixels: number): void {
    const current = this._selectedItem();
    if (!current) return;
    const width = this.clampPanelWidthInPixels(panelWidthInPixels);
    this._panelWidths.update((widths) => new Map(widths).set(current.label, width));
  }

  setPanelWidths(widths: ReadonlyMap<string, number>): void {
    this._panelWidths.set(
      new Map([...widths].map(([label, width]) => [label, this.clampPanelWidthInPixels(width)])),
    );
  }

  private clampPanelWidthInPixels(panelWidthInPixels: number): number {
    return Math.max(SideMenuService.minimumPanelWidthInPixels, Math.round(panelWidthInPixels));
  }
}
