import { ShellType } from "@cogno/core/infrastructure/config/models/config";
import { StackId, TabId } from "@cogno/core/workbench/grid-layout";
import { ColorName } from "@cogno/shared/support";

/** The ordered places of the tab bar: a tab or a stack of tabs, never a stack in a stack. */
export type TabList = TabSlot[];

export type TabSlot = Tab | TabStack;

export type Tab = {
  color?: ColorName;
  id: TabId;
  systemTitle: string;
  userTitle?: string;
  isActive: boolean;
  activeShellType: ShellType | "unknown";
};

/**
 * Tabs grouped into one place of the bar. Has at least two members; with one
 * left, the member takes the stack's place. The name is the stack's own and
 * never a member's title, so the head keeps still while members are switched.
 * `currentTabId` is the member the collapsed stack stands for: the one
 * selected last, always one of `tabs`. Whether the members are shown is a
 * state of the stack that only its chevron changes.
 */
export type TabStack = {
  id: StackId;
  name: string;
  color?: ColorName;
  currentTabId: TabId;
  isExpanded: boolean;
  tabs: Tab[];
};

export function isStack(slot: TabSlot): slot is TabStack {
  return "tabs" in slot;
}

/** The tabs in bar order, stack members in place of their stack. */
export function flatTabs(list: TabList): Tab[] {
  return list.flatMap((slot) => (isStack(slot) ? slot.tabs : [slot]));
}

/** A new list with every tab (member or not) passed through `change`. */
export function mapTabs(list: TabList, change: (tab: Tab) => Tab): TabList {
  return list.map((slot) =>
    isStack(slot) ? { ...slot, tabs: slot.tabs.map(change) } : change(slot),
  );
}
