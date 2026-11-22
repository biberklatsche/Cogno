import { computed, Injectable, Signal, signal, Type, WritableSignal } from "@angular/core";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { Icon } from "@cogno/shared/ui";

export type SideMenuItem = {
  id?: string;
  // Regular action item
  label: string;
  icon: Icon;
  order?: number;
  actionName: ActionName;
  separator?: boolean;
  // Optional component to render in the side "aside" area when this item is active
  component: Type<unknown> | null;
  // Optional badge color indicator
  badgeColor?: string;
  /** Shown below the feature entries, apart from them: the workbench's own panels. */
  bottom?: boolean;
  /** The panel's width before the user resized it; the common default otherwise. */
  defaultPanelWidthInPixels?: number;
};

/**
 * The side panels: pinned ones stand beside the terminals, side by side in the
 * rail's order, until each is closed with X; one floating panel at a time lies
 * over the terminals and the pinned ones, and another floating one replaces it.
 * One open panel at a time can be expanded over everything; while it is, it does
 * not stand among the pinned ones, and it goes back to its place when restored.
 * Pin and width belong to the panel and outlive its being open and its menu
 * item; expand lasts only while the panel is open. At most one panel has the
 * keyboard. A panel is dismissed the same way whoever it belongs to: by a
 * pointer press elsewhere and by Escape while it has the keyboard.
 */
@Injectable({ providedIn: "root" })
export class SideMenuService {
  private static readonly defaultPanelWidthInPixels = 360;
  private static readonly minimumPanelWidthInPixels = 280;
  private static readonly dismissKeyListenerId = "side-menu.dismiss";

  private readonly _menuItems: WritableSignal<SideMenuItem[]> = signal<SideMenuItem[]>([]);
  /** The pinned panels that are open. */
  private readonly _openPinnedLabels = signal<ReadonlySet<string>>(new Set());
  private readonly _floatingLabel = signal<string | undefined>(undefined);
  private readonly _focusedLabel = signal<string | undefined>(undefined);
  /** Each panel's own width, by label; a panel without one has the default. */
  private readonly _panelWidths = signal<ReadonlyMap<string, number>>(new Map());
  private readonly _pinnedLabels = signal<ReadonlySet<string>>(new Set());
  /** The open panel that spans the whole area, the terminals and the other panels. */
  private readonly _expandedLabel = signal<string | undefined>(undefined);

  readonly focusedLabel: Signal<string | undefined> = this._focusedLabel.asReadonly();
  readonly panelWidths: Signal<ReadonlyMap<string, number>> = this._panelWidths.asReadonly();
  readonly pinnedLabels: Signal<ReadonlySet<string>> = this._pinnedLabels.asReadonly();
  readonly expandedLabel: Signal<string | undefined> = this._expandedLabel.asReadonly();
  /**
   * The panels to bring back after a restart: the open pinned ones. A floating
   * panel is a quick look and is not brought back.
   */
  readonly openPinnedLabels: Signal<ReadonlySet<string>> = this._openPinnedLabels.asReadonly();

  /** The rail's entries in the rail's order: the features, then the workbench's own. */
  readonly railItems: Signal<ReadonlyArray<SideMenuItem>> = computed(() => {
    const items = this._menuItems();
    return [
      ...byOrder(items.filter((item) => !item.bottom)),
      ...byOrder(items.filter((item) => item.bottom)),
    ];
  });

  /** The open pinned panels, in the rail's order. */
  readonly dockedItems: Signal<ReadonlyArray<SideMenuItem>> = computed(() => {
    const open = this._openPinnedLabels();
    return this.railItems().filter((item) => open.has(item.label));
  });

  readonly floatingItem: Signal<SideMenuItem | undefined> = computed(() => {
    const label = this._floatingLabel();
    return label === undefined ? undefined : this._menuItems().find((s) => s.label === label);
  });

  constructor(
    private readonly bus: AppBus,
    private readonly keybinds: KeybindService,
  ) {}

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

  isOpen(label: string): boolean {
    return this._openPinnedLabels().has(label) || this._floatingLabel() === label;
  }

  isPinned(label: string): boolean {
    return this._pinnedLabels().has(label);
  }

  isExpanded(label: string): boolean {
    return this._expandedLabel() === label;
  }

  panelWidthInPixels(label: string): number {
    return (
      this._panelWidths().get(label) ??
      this._menuItems().find((item) => item.label === label)?.defaultPanelWidthInPixels ??
      SideMenuService.defaultPanelWidthInPixels
    );
  }

  /**
   * Opens a panel: a pinned one beside the others, a floating one in place of
   * the floating one. `focusView` is false only when panels come back on their
   * own (after a restart): they show but leave the keyboard to the terminal.
   */
  open(label: string, focusView = true): void {
    if (!this._menuItems().some((item) => item.label === label)) return;

    if (!this.isOpen(label)) {
      if (this.isPinned(label)) {
        this._openPinnedLabels.update((labels) => withLabel(labels, label));
      } else {
        this.float(label);
      }
      this.bus.publish({ type: "SideMenuViewOpened", payload: { label } });
    }

    if (focusView) this.focus(label);
  }

  /**
   * A panel's shortcut: opens the panel, takes the keyboard to it when it is
   * open but unfocused, and closes it, as the X does, when it has the keyboard.
   */
  toggle(label: string): void {
    // Only an open panel has the keyboard.
    if (this._focusedLabel() === label) {
      this.close(label);
      return;
    }
    this.open(label);
  }

  /** Closes the panel, pinned or not, as its X does. */
  close(label: string): void {
    if (!this.isOpen(label)) return;
    this.hide(label);
    if (this._focusedLabel() === undefined) this.bus.publish({ type: "FocusActiveTerminal" });
  }

  /**
   * Done with the panel for now (Escape, a click elsewhere): a floating one
   * closes, a pinned one stays and gives the keyboard back to the terminal -
   * at its normal size, so the terminal is there to be seen.
   */
  dismiss(label: string): void {
    if (!this.isOpen(label)) return;
    // Where the panel lies decides, not what it is set to: the two differ
    // when the pins are restored while a panel already floats.
    if (this._floatingLabel() === label) {
      this.close(label);
      return;
    }
    if (this._focusedLabel() !== label) return;
    if (this._expandedLabel() === label) this._expandedLabel.set(undefined);
    this.blur();
    this.bus.publish({ type: "FocusActiveTerminal" });
  }

  /**
   * A pointer went down on the panel `label`, or beside every panel when there
   * is none. The panel takes the keyboard; the floating panel is dismissed
   * unless it is the one; beside every panel, so is the one with the keyboard.
   * The clicked panel comes first, so the keyboard does not pass by the terminal.
   */
  pointerDown(label: string | undefined): void {
    if (label !== undefined) this.focus(label);
    const floating = this._floatingLabel();
    if (floating !== undefined && floating !== label) this.dismiss(floating);
    const focused = this._focusedLabel();
    if (label === undefined && focused !== undefined) this.dismiss(focused);
  }

  focus(label: string): void {
    if (!this.isOpen(label) || this._focusedLabel() === label) return;
    this.blur();
    this._focusedLabel.set(label);
    // Before the panel hears of its focus: a panel that binds Escape itself
    // there lies on top of this and decides when to dismiss.
    this.keybinds.registerListener(SideMenuService.dismissKeyListenerId, ["Escape"], () =>
      this.dismiss(label),
    );
    this.bus.publish({ type: "SideMenuViewFocused", payload: { label } });
  }

  blur(): void {
    const label = this._focusedLabel();
    if (label === undefined) return;
    this._focusedLabel.set(undefined);
    this.keybinds.unregisterListener(SideMenuService.dismissKeyListenerId);
    this.bus.publish({ type: "SideMenuViewBlurred", payload: { label } });
  }

  /**
   * An open panel changes sides and stays open: pinned it joins the others,
   * unpinned it becomes the floating one and replaces the panel floating so far.
   */
  togglePin(label: string): void {
    const pinned = !this.isPinned(label);
    this._pinnedLabels.update((labels) =>
      pinned ? withLabel(labels, label) : withoutLabel(labels, label),
    );
    if (!this.isOpen(label)) return;

    if (pinned) {
      this._floatingLabel.set(undefined);
      this._openPinnedLabels.update((labels) => withLabel(labels, label));
      return;
    }
    this._openPinnedLabels.update((labels) => withoutLabel(labels, label));
    this.float(label);
  }

  /** Expands an open panel in place of the one expanded so far, or restores it. */
  toggleExpanded(label: string): void {
    if (!this.isOpen(label)) return;
    this._expandedLabel.update((expanded) => (expanded === label ? undefined : label));
  }

  setPinnedLabels(labels: ReadonlyArray<string>): void {
    this._pinnedLabels.set(new Set(labels));
  }

  updateBadgeColor(label: string, color?: string) {
    this._menuItems.update((s) =>
      s.map((i) => (i.label === label ? { ...i, badgeColor: color } : i)),
    );
  }

  setPanelWidthInPixels(label: string, panelWidthInPixels: number): void {
    const width = this.clampPanelWidthInPixels(panelWidthInPixels);
    this._panelWidths.update((widths) => new Map(widths).set(label, width));
  }

  setPanelWidths(widths: ReadonlyMap<string, number>): void {
    this._panelWidths.set(
      new Map([...widths].map(([label, width]) => [label, this.clampPanelWidthInPixels(width)])),
    );
  }

  /** Makes the panel the floating one, in place of the one floating so far. */
  private float(label: string): void {
    const floating = this._floatingLabel();
    if (floating !== undefined) this.hide(floating);
    this._floatingLabel.set(label);
  }

  /** Takes an open panel away, its keyboard focus first. */
  private hide(label: string): void {
    if (this._focusedLabel() === label) this.blur();
    if (this._expandedLabel() === label) this._expandedLabel.set(undefined);
    if (this._floatingLabel() === label) this._floatingLabel.set(undefined);
    this._openPinnedLabels.update((labels) => withoutLabel(labels, label));
    this.bus.publish({ type: "SideMenuViewClosed", payload: { label } });
  }

  private clampPanelWidthInPixels(panelWidthInPixels: number): number {
    return Math.max(SideMenuService.minimumPanelWidthInPixels, Math.round(panelWidthInPixels));
  }
}

function withLabel(labels: ReadonlySet<string>, label: string): ReadonlySet<string> {
  return labels.has(label) ? labels : new Set(labels).add(label);
}

function withoutLabel(labels: ReadonlySet<string>, label: string): ReadonlySet<string> {
  if (!labels.has(label)) return labels;
  const next = new Set(labels);
  next.delete(label);
  return next;
}

function byOrder(items: SideMenuItem[]): SideMenuItem[] {
  return items.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}
