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
 * A pinned panel is like one more pane: Escape and a press elsewhere only take
 * the keyboard from it. The floating one is like a dialog: they close it.
 * A panel set to expand spans everything while it has the keyboard and stands
 * at its size otherwise, so the terminal is never hidden while it has the
 * keyboard and only one panel is expanded at a time. Pin, expand and width
 * belong to the panel and outlive its being open and its menu item. At most
 * one panel has the keyboard, and every panel loses it the same way, whoever
 * it belongs to.
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
  /** Expanding panels: set to span the whole area, the terminals and the other panels, while they have the keyboard. */
  private readonly _expandingLabels = signal<ReadonlySet<string>>(new Set());

  readonly focusedLabel: Signal<string | undefined> = this._focusedLabel.asReadonly();
  readonly panelWidths: Signal<ReadonlyMap<string, number>> = this._panelWidths.asReadonly();
  readonly pinnedLabels: Signal<ReadonlySet<string>> = this._pinnedLabels.asReadonly();
  readonly expandingLabels: Signal<ReadonlySet<string>> = this._expandingLabels.asReadonly();
  /**
   * A pinned panel has the keyboard. It is one of the panes then, and the
   * terminals show that they do not have it, as they do among themselves.
   */
  readonly keyboardInPinnedPanel: Signal<boolean> = computed(() => {
    const focused = this._focusedLabel();
    return focused !== undefined && focused !== this._floatingLabel();
  });
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

  /**
   * Every open panel in the rail's order, which is the order the pinned ones
   * stand in. The floating one is among them and laid out apart, so pinning or
   * unpinning an open panel changes its place and look and nothing else.
   */
  readonly openItems: Signal<ReadonlyArray<SideMenuItem>> = computed(() => {
    const pinned = this._openPinnedLabels();
    const floating = this._floatingLabel();
    return this.railItems().filter((item) => pinned.has(item.label) || item.label === floating);
  });

  readonly floatingLabel: Signal<string | undefined> = this._floatingLabel.asReadonly();

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

  /** Set to expand; whether it is expanded right now is `isExpanded`. */
  isExpanding(label: string): boolean {
    return this._expandingLabels().has(label);
  }

  isExpanded(label: string): boolean {
    return this._expandingLabels().has(label) && this._focusedLabel() === label;
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
   * A panel's shortcut and its icon in the rail: opens the panel and takes the
   * keyboard to it - which shows it, should another panel lie over it. On the
   * panel that has the keyboard it is done with the panel as Escape is: the
   * floating one closes, a pinned one stays and the terminal gets the
   * keyboard back. Only its X closes a pinned panel.
   */
  toggle(label: string): void {
    if (this._focusedLabel() === label) this.dismiss(label);
    else this.open(label);
  }

  /** Closes the panel, pinned or not, as its X does. */
  close(label: string): void {
    if (!this.isOpen(label)) return;
    this.hide(label);
    if (this._focusedLabel() === undefined) this.bus.publish({ type: "FocusActiveTerminal" });
  }

  /**
   * Done with the panel for now (Escape, a click elsewhere): a floating one
   * closes, a pinned one stays and gives the keyboard back to the terminal.
   */
  dismiss(label: string): void {
    if (this._floatingLabel() === label) {
      this.close(label);
      return;
    }
    if (this._focusedLabel() !== label) return;
    this.blur();
    this.bus.publish({ type: "FocusActiveTerminal" });
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

  /**
   * The keyboard went somewhere by itself: into the panel `label`, by Tab, or
   * out of every panel when there is none - a terminal took it. Nothing is
   * dismissed for that; the panel only stops having the keyboard.
   */
  keyboardMovedTo(label: string | undefined): void {
    if (label !== undefined) this.focus(label);
    else this.blur();
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
      this.moveToPinned(label);
      return;
    }
    this._openPinnedLabels.update((labels) => withoutLabel(labels, label));
    this.float(label);
  }

  /** Makes the panel an expanding one, expanded while it has the keyboard, or takes that back. */
  toggleExpanding(label: string): void {
    this._expandingLabels.update((labels) =>
      labels.has(label) ? withoutLabel(labels, label) : withLabel(labels, label),
    );
  }

  /** The expanding panels of the last run, added to those set since the start. */
  restoreExpandingLabels(labels: ReadonlyArray<string>): void {
    this._expandingLabels.update((expanding) => new Set([...expanding, ...labels]));
  }

  /**
   * The pins of the last run, added to those set since the start. A panel
   * opened floating before they arrived goes where it is pinned, so where a
   * panel lies always follows its pin.
   */
  restorePinnedLabels(labels: ReadonlyArray<string>): void {
    this._pinnedLabels.update((pinned) => new Set([...pinned, ...labels]));
    const floating = this._floatingLabel();
    if (floating !== undefined && this.isPinned(floating)) this.moveToPinned(floating);
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
   * Closes the floating panel for another panel. The panel with the keyboard
   * is there to be seen, and the floating one lies over the pinned ones; and
   * only one panel floats.
   */
  private uncover(label: string): void {
    const floating = this._floatingLabel();
    if (floating !== undefined && floating !== label) this.hide(floating);
  }

  /** The floating panel takes its place among the pinned ones and stays open. */
  private moveToPinned(label: string): void {
    this._floatingLabel.set(undefined);
    this._openPinnedLabels.update((labels) => withLabel(labels, label));
  }

  /** Makes the panel the floating one, in place of the one floating so far. */
  private float(label: string): void {
    this.uncover(label);
    this._floatingLabel.set(label);
  }

  /** Takes an open panel away, its keyboard focus first. */
  private hide(label: string): void {
    if (this._focusedLabel() === label) this.blur();
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
