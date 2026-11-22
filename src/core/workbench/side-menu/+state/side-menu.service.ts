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
  static readonly minimumPanelWidthInPixels = 280;
  private static readonly dismissKeyListenerId = "side-menu.dismiss";

  private readonly _menuItems: WritableSignal<SideMenuItem[]> = signal<SideMenuItem[]>([]);
  /** The pinned panels that are open. */
  private readonly _openPinnedLabels = signal<ReadonlySet<string>>(new Set());
  /** Pinned panels of the last run whose menu item is not there yet; they open when it comes. */
  private readonly _labelsToReopen = signal<ReadonlySet<string>>(new Set());
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
  /**
   * The panels to bring back after a restart: the open pinned ones, and those
   * of the last run still waiting for their menu item. A floating panel is a
   * quick look and is not brought back.
   */
  readonly labelsToBringBack: Signal<ReadonlySet<string>> = computed(
    () => new Set([...this._openPinnedLabels(), ...this._labelsToReopen()]),
  );

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
    this.reopenIfDue(item.label);
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
   * own (`reopen`): they show but leave the keyboard to the terminal.
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
   * A panel's shortcut and its icon in the rail: opens the panel, takes the
   * keyboard to it when it is open but unfocused - which shows it, should
   * another panel lie over it - and closes it, as the X does, when it has the
   * keyboard.
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
    if (this._focusedLabel() === undefined) this.passKeyboardOn();
  }

  /**
   * Done with the panel for now (Escape, a click elsewhere): a floating one
   * closes, a pinned one stays and gives the keyboard back to the terminal -
   * at its normal size, so the terminal is there to be seen.
   */
  dismiss(label: string): void {
    if (this._floatingLabel() === label) {
      this.close(label);
      return;
    }
    if (this._focusedLabel() !== label) return;
    this._expandedLabel.set(undefined);
    this.blur();
    this.passKeyboardOn();
  }

  /**
   * A pointer went down on the panel `label`, or beside every panel when there
   * is none. The panel takes the keyboard; beside every panel, the floating
   * one and the one with the keyboard are dismissed.
   */
  pointerDown(label: string | undefined): void {
    if (label !== undefined) {
      this.focus(label);
      return;
    }
    const floating = this._floatingLabel();
    if (floating !== undefined) this.dismiss(floating);
    const focused = this._focusedLabel();
    if (focused !== undefined) this.dismiss(focused);
  }

  /** Gives the keyboard to an open panel. */
  private focus(label: string): void {
    if (this._focusedLabel() === label) return;
    this.blur();
    this.uncover(label);
    this._focusedLabel.set(label);
    // Before the panel hears of its focus: a panel that binds Escape itself
    // there lies on top of this and decides when to dismiss.
    this.keybinds.registerListener(SideMenuService.dismissKeyListenerId, ["Escape"], () =>
      this.dismiss(label),
    );
    this.bus.publish({ type: "SideMenuViewFocused", payload: { label } });
  }

  private blur(): void {
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
      this.dock(label);
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

  /**
   * The pins of the last run. A panel opened floating before they arrived
   * goes where it is pinned, so where a panel lies always follows its pin.
   */
  setPinnedLabels(labels: ReadonlyArray<string>): void {
    this._pinnedLabels.set(new Set(labels));
    const floating = this._floatingLabel();
    if (floating !== undefined && this.isPinned(floating)) this.dock(floating);
  }

  /**
   * Brings the pinned panels of the last run back, beside the terminals, which
   * keep the keyboard. A panel whose menu item is not there yet - its feature
   * is still starting - comes back as soon as it is.
   */
  reopen(labels: ReadonlyArray<string>): void {
    this._labelsToReopen.set(new Set(labels));
    for (const label of labels) this.reopenIfDue(label);
  }

  updateBadgeColor(label: string, color?: string) {
    this._menuItems.update((s) =>
      s.map((i) => (i.label === label ? { ...i, badgeColor: color } : i)),
    );
  }

  setPanelWidthInPixels(label: string, panelWidthInPixels: number): void {
    const width = this.clampPanelWidthInPixels(panelWidthInPixels);
    this._panelWidths.update((widths) =>
      widths.get(label) === width ? widths : new Map(widths).set(label, width),
    );
  }

  setPanelWidths(widths: ReadonlyMap<string, number>): void {
    this._panelWidths.set(
      new Map([...widths].map(([label, width]) => [label, this.clampPanelWidthInPixels(width)])),
    );
  }

  private reopenIfDue(label: string): void {
    if (!this._labelsToReopen().has(label)) return;
    if (!this._menuItems().some((item) => item.label === label)) return;
    this._labelsToReopen.update((labels) => withoutLabel(labels, label));
    if (this.isPinned(label)) this.open(label, false);
  }

  /**
   * No panel has the keyboard any more. It goes to the expanded panel, which
   * covers the terminals, and to the terminal otherwise.
   */
  private passKeyboardOn(): void {
    const expanded = this._expandedLabel();
    if (expanded !== undefined) this.focus(expanded);
    else this.bus.publish({ type: "FocusActiveTerminal" });
  }

  /**
   * The panel with the keyboard is there to be seen. The floating panel and an
   * expanded one lie over the pinned ones, so for a pinned panel the floating
   * one closes and the expanded one goes back to its size. The floating panel
   * lies over everything and needs nothing.
   */
  private uncover(label: string): void {
    const floating = this._floatingLabel();
    if (floating === label) return;
    if (floating !== undefined) this.hide(floating);
    if (this._expandedLabel() !== label) this._expandedLabel.set(undefined);
  }

  /** The floating panel takes its place among the pinned ones and stays open. */
  private dock(label: string): void {
    this._floatingLabel.set(undefined);
    this._openPinnedLabels.update((labels) => withLabel(labels, label));
    if (this._focusedLabel() === label) this.uncover(label);
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
