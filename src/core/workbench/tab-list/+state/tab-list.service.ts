import { DestroyRef, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ActionKeybindingPort } from "@cogno/core/infrastructure/keybindings/action-keybinding-port";
import { ActionHandlers } from "@cogno/core/workbench/actions/action-handlers";
import { actionLabel, SLOTS } from "@cogno/core/workbench/actions/catalog";
import { ActionName } from "@cogno/core/workbench/bus/action.models";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { ChangeTabTitleEvent } from "@cogno/core/workbench/bus/grid-list/events";
import {
  CreateTabAction,
  RemoveTabAction,
  SelectTabAction,
} from "@cogno/core/workbench/bus/tab-list/actions";
import { StackId, TabConfig, TabId, TabStackConfig } from "@cogno/core/workbench/grid-layout";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { defaultWorkspaceIdContract } from "@cogno/core/workbench/workspace/workspace-entry";
import { ColorName } from "@cogno/shared/support";
import { ContextMenuItem } from "@cogno/shared/ui";
import { BehaviorSubject, map, Observable } from "rxjs";
import { flatTabs, isStack, mapTabs, Tab, TabList, TabSlot, TabStack } from "../+model/tab";

/** Where a dragged tab or stack lands relative to the target. */
export type PlacementSide = "before" | "after";

/** A slot in bar order with the index it had before a tab was taken out. */
type PositionedSlot = { slot: TabSlot; originalIndex: number };

/** What stands in for the item at `index` once it is gone: the one before it, else the first. */
function neighbourBefore<T>(items: T[], index: number): T | undefined {
  const remaining = items.filter((_item, itemIndex) => itemIndex !== index);
  return remaining.length > 0 ? remaining[Math.max(index - 1, 0)] : undefined;
}

@Injectable({ providedIn: "root" })
export class TabListService {
  private _showRename: WritableSignal<TabId | StackId | undefined> = signal(undefined);
  /** The slots of every workspace, shown or not; the only store. */
  private readonly tabListByWorkspaceIdentifier = new Map<string, TabList>();
  private activeWorkspaceIdentifier: string | undefined = defaultWorkspaceIdContract;
  /** Fires after every write that changes what the shown workspace lists. */
  private readonly activeTabsChanged = new BehaviorSubject<void>(undefined);

  /** The shown workspace's slots; a new list on every write. */
  readonly slots$: Observable<TabList> = this.activeTabsChanged.pipe(map(() => this.activeSlots()));

  get showRename$(): Signal<TabId | StackId | undefined> {
    return this._showRename.asReadonly();
  }

  activateWorkspace(workspaceIdentifier: string): void {
    this.activeWorkspaceIdentifier = workspaceIdentifier;
    if (!this.tabListByWorkspaceIdentifier.has(workspaceIdentifier)) {
      this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, []);
    }
    this._showRename.set(undefined);
    this.activeTabsChanged.next();
  }

  removeWorkspaceRuntime(workspaceIdentifier: string): void {
    this.tabListByWorkspaceIdentifier.delete(workspaceIdentifier);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeWorkspaceIdentifier = undefined;
      this._showRename.set(undefined);
      this.activeTabsChanged.next();
    }
  }

  constructor(
    private bus: AppBus,
    private readonly configService: ConfigService,
    private readonly keybindings: ActionKeybindingPort,
    actions: ActionHandlers,
    destroyRef: DestroyRef,
  ) {
    this.bus
      .on$("SelectTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: SelectTabAction) => {
        if (!event.payload) return;
        this.selectTab(event.payload);
      });
    this.bus
      .on$("RemoveTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: RemoveTabAction) => {
        this.removeTab(event.payload);
      });
    this.bus
      .on$("CreateTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: CreateTabAction) => {
        if (!event.payload?.tabId) return;
        const shellName = event.payload.shellName;
        this.addTab(
          {
            id: event.payload.tabId,
            systemTitle: event.payload.systemTitle ?? "Shell",
            activeShellType: configService.getShellProfileOrDefault(shellName).shell_type,
            isActive: event.payload.isActive ?? true,
          },
          { shellName, workingDir: event.payload.workingDir },
        );
      });
    this.bus
      .on$("ChangeTabTitle")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: ChangeTabTitleEvent) => {
        const workspaceIdentifier = event.payload && this.workspaceOfTab(event.payload.tabId);
        if (!workspaceIdentifier || !event.payload?.title) return;
        const title = event.payload.title;
        this.updateTab(workspaceIdentifier, event.payload.tabId, (tab) => ({
          ...tab,
          systemTitle: title,
        }));
      });
    actions.handle("new_tab", (context) =>
      this.openShell(
        context.args?.[0] ?? this.configService.getShellProfileByShortcutIndex(1)?.name,
      ),
    );
    actions.handle("close_tab", () => {
      this.removeTab(this.activeTabs().find((tab) => tab.isActive)?.id);
    });
    actions.handle("select_next_tab", () => this.selectAdjacentTab(1));
    actions.handle("select_previous_tab", () => this.selectAdjacentTab(-1));
    actions.handle("close_other_tabs", () => {
      this.removeAllTabs(this.activeTabs().find((tab) => tab.isActive)?.id);
    });
    actions.handle("close_all_tabs", () => this.removeAllTabs());
    for (const slot of SLOTS) {
      actions.handle(`open_shell_${slot}`, () =>
        this.openShell(this.configService.getShellProfileByShortcutIndex(slot)?.name),
      );
      actions.handle(`select_tab_${slot}`, () => this.selectSlotByShortcutIndex(slot));
    }
  }

  buildContextMenu(tabId: TabId): ContextMenuItem[] {
    const tab = this.activeTabs().find((tab) => tab.id === tabId);
    if (!tab) throw new Error("No tab found for TabList");
    const items: (ContextMenuItem | undefined)[] = [
      {
        label: actionLabel("close_tab"),
        action: () => this.removeTab(tabId),
        keybinding: this.keybindingFor("close_tab"),
      },
      this.activeTabs().length > 1
        ? {
            label: actionLabel("close_other_tabs"),
            action: () => this.removeAllTabs(tabId),
            keybinding: this.keybindingFor("close_other_tabs"),
          }
        : undefined,
      {
        label: actionLabel("close_all_tabs"),
        action: () => this.removeAllTabs(),
        keybinding: this.keybindingFor("close_all_tabs"),
      },
      { separator: true },
      { label: "Rename tab", action: () => this._showRename.set(tabId) },
      tab.userTitle
        ? { label: "Reset Tab Name", action: () => this.resetTabName(tabId) }
        : undefined,
      { separator: true },
      { custom: true },
    ];
    return items.filter((s) => !!s);
  }

  buildStackContextMenu(stackId: StackId): ContextMenuItem[] {
    const stack = this.findStack(this.activeSlots(), stackId);
    if (!stack) throw new Error("No stack found for TabList");
    const items: (ContextMenuItem | undefined)[] = [
      { label: "Close stack", action: () => this.closeStack(stackId) },
      { label: "Unstack", action: () => this.unstack(stackId) },
      { separator: true },
      { label: "Rename stack", action: () => this._showRename.set(stackId) },
      { separator: true },
      { custom: true },
    ];
    return items.filter((s) => !!s);
  }

  private keybindingFor(actionName: ActionName): string {
    return this.keybindings.getKeybindingLabel(actionName);
  }

  removeAllTabs(except?: TabId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabs = this.activeTabs();
    const kept = tabs.find((tab) => tab.id === except);
    this.setTabListForWorkspace(workspaceIdentifier, kept ? [kept] : []);
    for (const tab of tabs) {
      if (tab.id === except) continue;
      this.bus.publish({ type: "TabRemoved", payload: tab.id });
    }
  }

  /** Adds a copy of `tab` as the last slot of the shown workspace; the caller keeps its own object. */
  addTab(tab: Tab, paneConfig?: { shellName?: string; workingDir?: string }) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    if (this.activeTabs().some((s) => s.id === tab?.id)) return;
    const others = tab.isActive
      ? mapTabs(slots, (other) => ({ ...other, isActive: false }))
      : slots;
    this.setTabListForWorkspace(workspaceIdentifier, [...others, { ...tab }]);
    this.bus.publish({
      type: "TabAdded",
      payload: {
        tabId: tab.id,
        isActive: tab.isActive,
        shellName: paneConfig?.shellName,
        workingDir: paneConfig?.workingDir,
      },
    });
  }

  /** Removes `tabId` - from whichever workspace holds it, shown or not. */
  removeTab(tabId?: TabId) {
    if (!tabId) return;
    const workspaceIdentifier = this.workspaceOfTab(tabId);
    if (!workspaceIdentifier) return;
    const slots = this.getTabListForWorkspace(workspaceIdentifier);
    const tabs = flatTabs(slots);
    const removed = tabs.find((tab) => tab.id === tabId);
    if (!removed) return;
    const nextActiveTab = removed.isActive ? this.neighbourOf(slots, tabId) : undefined;
    const { slots: remaining } = this.extractTab(slots, tabId);
    const isShown = workspaceIdentifier === this.activeWorkspaceIdentifier;
    // A workspace in the background only notes its next active tab; selecting
    // it for real happens when the workspace is shown.
    this.setTabListForWorkspace(
      workspaceIdentifier,
      nextActiveTab && !isShown
        ? mapTabs(remaining, (tab) =>
            tab.id === nextActiveTab.id ? { ...tab, isActive: true } : tab,
          )
        : remaining,
    );
    this.bus.publish({ type: "TabRemoved", payload: tabId });
    if (nextActiveTab && isShown) {
      this.selectTab(nextActiveTab.id);
    }
  }

  /** Closes every member of the stack; the slot before it becomes active if one of them was. */
  closeStack(stackId: StackId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    const stackIndex = slots.findIndex((slot) => slot.id === stackId);
    const stack = slots[stackIndex];
    if (!stack || !isStack(stack)) return;
    const nextActiveSlot = stack.tabs.some((tab) => tab.isActive)
      ? neighbourBefore(slots, stackIndex)
      : undefined;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      slots.filter((slot) => slot.id !== stackId),
    );
    for (const tab of stack.tabs) {
      this.bus.publish({ type: "TabRemoved", payload: tab.id });
    }
    if (nextActiveSlot) {
      this.selectTab(isStack(nextActiveSlot) ? nextActiveSlot.currentTabId : nextActiveSlot.id);
    }
  }

  /** The members take the stack's place as slots of their own. */
  unstack(stackId: StackId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    if (!this.findStack(slots, stackId)) return;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      slots.flatMap((slot) => (slot.id === stackId && isStack(slot) ? slot.tabs : [slot])),
    );
  }

  /**
   * Puts a tab, a stack or a stack member (taken out of its stack) before or
   * after another slot of the shown workspace.
   */
  placeSlot(draggedId: TabId | StackId, targetSlotId: TabId | StackId, side: PlacementSide) {
    if (draggedId === targetSlotId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    const targetIndex = slots.findIndex((slot) => slot.id === targetSlotId);
    if (targetIndex === -1) return;
    const { positioned, dragged } = this.takeOut(slots, draggedId);
    if (!dragged) return;
    const insertAt = positioned.filter(({ originalIndex }) =>
      side === "before" ? originalIndex < targetIndex : originalIndex <= targetIndex,
    ).length;
    const result = positioned.map(({ slot }) => slot);
    result.splice(insertAt, 0, dragged);
    if (this.sameShape(slots, result)) return;
    this.setTabListForWorkspace(workspaceIdentifier, result);
  }

  /**
   * Puts a tab before or after a member of the stack: from outside, from
   * another stack, or from the same stack (a plain reorder then).
   */
  placeTabInStack(tabId: TabId, stackId: StackId, targetTabId: TabId, side: PlacementSide) {
    if (tabId === targetTabId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    const stack = this.findStack(slots, stackId);
    if (!stack || !stack.tabs.some((tab) => tab.id === targetTabId)) return;
    const isMember = stack.tabs.some((tab) => tab.id === tabId);
    const { slots: without, tab } = isMember
      ? { slots, tab: stack.tabs.find((member) => member.id === tabId) }
      : this.extractTab(slots, tabId);
    if (!tab) return;
    const result = without.map((slot) => {
      if (slot.id !== stackId || !isStack(slot)) return slot;
      const members = slot.tabs.filter((member) => member.id !== tabId);
      const targetIndex = members.findIndex((member) => member.id === targetTabId);
      members.splice(side === "before" ? targetIndex : targetIndex + 1, 0, tab);
      return { ...slot, tabs: members };
    });
    if (this.sameShape(slots, result)) return;
    this.setTabListForWorkspace(workspaceIdentifier, result);
  }

  /** A new, collapsed stack in the place of `ontoTabId` holding it and the dragged tab. */
  stackTabs(tabId: TabId, ontoTabId: TabId) {
    if (tabId === ontoTabId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    const onto = slots.find((slot) => slot.id === ontoTabId);
    if (!onto || isStack(onto)) return;
    const { slots: without, tab } = this.extractTab(slots, tabId);
    if (!tab) return;
    const stack: TabStack = {
      id: IdCreator.newStackId(),
      name: this.nextStackName(slots),
      currentTabId: tab.isActive ? tab.id : onto.id,
      isExpanded: false,
      tabs: [onto, tab],
    };
    this.setTabListForWorkspace(
      workspaceIdentifier,
      without.map((slot) => (slot.id === ontoTabId ? stack : slot)),
    );
  }

  selectTab(tabId: TabId) {
    if (this._showRename()) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const slots = this.activeSlots();
    if (!this.activeTabs().some((tab) => tab.id === tabId)) return;
    const selected = slots.map((slot) => {
      if (!isStack(slot)) return { ...slot, isActive: slot.id === tabId };
      const members = slot.tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId }));
      const isMember = members.some((tab) => tab.id === tabId);
      return { ...slot, tabs: members, currentTabId: isMember ? tabId : slot.currentTabId };
    });
    this.setTabListForWorkspace(workspaceIdentifier, selected);
    this.bus.publish({ type: "TabSelected", payload: tabId });
  }

  /** Brings the member the stack stands for to the front; shown or hidden members stay as they are. */
  selectStack(stackId: StackId) {
    const stack = this.findStack(this.activeSlots(), stackId);
    if (!stack) return;
    this.selectTab(stack.currentTabId);
  }

  /** Shows the stack's members, or hides them again; nothing is selected by it. */
  toggleStack(stackId: StackId) {
    this.updateStack(this.getRequiredActiveWorkspaceIdentifier(), stackId, (stack) => ({
      ...stack,
      isExpanded: !stack.isExpanded,
    }));
  }

  closeRename() {
    this._showRename.set(undefined);
    this.focusActiveTerminal();
  }

  commitRename(value: string) {
    if (!value?.trim()) return;
    const id = this._showRename();
    if (!id) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    if (this.findStack(this.activeSlots(), id)) {
      this.updateStack(workspaceIdentifier, id, (stack) => ({ ...stack, name: value }));
    } else {
      this.updateTab(workspaceIdentifier, id, (tab) => ({ ...tab, userTitle: value }));
    }
    this.closeRename();
  }

  resetTabName(tabId: TabId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    if (!this.activeTabs().find((tab) => tab.id === tabId)?.userTitle) return;
    this.updateTab(workspaceIdentifier, tabId, (tab) => ({ ...tab, userTitle: undefined }));
  }

  setColor(tabId: TabId, name: ColorName | undefined) {
    this.updateTab(this.getRequiredActiveWorkspaceIdentifier(), tabId, (tab) => ({
      ...tab,
      color: name,
    }));
  }

  setStackColor(stackId: StackId, name: ColorName | undefined) {
    this.updateStack(this.getRequiredActiveWorkspaceIdentifier(), stackId, (stack) => ({
      ...stack,
      color: name,
    }));
  }

  /**
   * Rebuilds the slots from the persisted tabs and stacks. Members join the
   * stack named by their `stackId` at its first member's place; a stack left
   * with fewer than two members is dissolved, one without members is dropped.
   * A stack stands for its active member, else the saved one, else the first.
   */
  restoreTabs(
    tabConfigList: TabConfig[],
    stackConfigList: TabStackConfig[],
    workspaceIdentifier?: string,
  ) {
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    const stackConfigs = new Map(stackConfigList.map((stack) => [stack.stackId, stack]));
    const stacksById = new Map<StackId, TabStack>();
    const slots: TabList = [];
    for (const config of tabConfigList) {
      const tab: Tab = {
        id: config.tabId,
        color: config.color as ColorName | undefined,
        systemTitle: config.systemTitle ?? "Shell",
        userTitle: config.userTitle,
        isActive: config.isActive ?? false,
        activeShellType: "unknown",
      };
      if (!config.stackId) {
        slots.push(tab);
        continue;
      }
      const stack = stacksById.get(config.stackId);
      if (stack) {
        stack.tabs.push(tab);
        continue;
      }
      const created: TabStack = {
        id: config.stackId,
        name: stackConfigs.get(config.stackId)?.name ?? "",
        color: stackConfigs.get(config.stackId)?.color as ColorName | undefined,
        currentTabId: stackConfigs.get(config.stackId)?.currentTabId ?? tab.id,
        isExpanded: stackConfigs.get(config.stackId)?.isExpanded ?? false,
        tabs: [tab],
      };
      stacksById.set(config.stackId, created);
      slots.push(created);
    }
    const repaired: TabList = [];
    for (const slot of slots) {
      if (!isStack(slot)) {
        repaired.push(slot);
        continue;
      }
      repaired.push(
        ...this.normalizeStack({
          ...slot,
          name: slot.name || this.nextStackName([...slots, ...repaired]),
        }),
      );
    }
    this.setTabListForWorkspace(targetWorkspaceIdentifier, repaired);
  }

  /** "Stack N" with the smallest N no stack of the list is named after. */
  private nextStackName(slots: TabList): string {
    const taken = new Set(slots.filter(isStack).map((stack) => stack.name));
    for (let number = 1; ; number++) {
      const candidate = `Stack ${number}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /** The tabs in bar order; a member carries the id of its stack. */
  getTabConfigs(workspaceIdentifier?: string): TabConfig[] {
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    const toConfig = (tab: Tab, stackId?: StackId): TabConfig => ({
      tabId: tab.id,
      isActive: tab.isActive,
      color: tab.color,
      systemTitle: tab.systemTitle,
      userTitle: tab.userTitle,
      stackId,
    });
    return this.getTabListForWorkspace(targetWorkspaceIdentifier).flatMap((slot) =>
      isStack(slot) ? slot.tabs.map((tab) => toConfig(tab, slot.id)) : [toConfig(slot)],
    );
  }

  getTabStackConfigs(workspaceIdentifier?: string): TabStackConfig[] {
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    return this.getTabListForWorkspace(targetWorkspaceIdentifier)
      .filter(isStack)
      .map((stack) => ({
        stackId: stack.id,
        name: stack.name,
        color: stack.color,
        currentTabId: stack.currentTabId,
        isExpanded: stack.isExpanded,
      }));
  }

  focusActiveTerminal() {
    const activeTab = this.activeTabs().find((s) => s.isActive);
    if (activeTab) {
      this.bus.publish({ type: "FocusActiveTerminal" });
    }
  }

  private selectAdjacentTab(direction: 1 | -1): void {
    const tabs = this.activeTabs();
    if (tabs.length < 2) return;

    const currentIndex = tabs.findIndex((tab) => tab.isActive);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + tabs.length) % tabs.length;
    this.selectTab(tabs[nextIndex].id);
  }

  private openShell(shellName?: string): void {
    if (!shellName) {
      return;
    }
    this.addTab(
      {
        id: IdCreator.newTabId(),
        systemTitle: "Shell",
        activeShellType: this.configService.getShellProfileOrDefault(shellName).shell_type,
        isActive: true,
      },
      { shellName },
    );
  }

  /** `select_tab_N` names the N-th slot as shown; a stack stands for its current member. */
  private selectSlotByShortcutIndex(index: number): void {
    const slot = this.activeSlots()[index - 1];
    if (!slot) {
      return;
    }
    this.selectTab(isStack(slot) ? slot.currentTabId : slot.id);
  }

  /**
   * The tab to activate after `tabId` is gone: its neighbour in the stack
   * (the one before, else the first), or without a stack its neighbour in the
   * flat order.
   */
  private neighbourOf(slots: TabList, tabId: TabId): Tab | undefined {
    const stack = this.stackOf(slots, tabId);
    const tabs = stack ? stack.tabs : flatTabs(slots);
    return neighbourBefore(
      tabs,
      tabs.findIndex((tab) => tab.id === tabId),
    );
  }

  /**
   * The list without `tabId`, from a slot or a stack. A stack left with one
   * member is replaced by that member; one that loses its current member
   * points at the neighbour before it.
   */
  private extractTab(slots: TabList, tabId: TabId): { slots: TabList; tab: Tab | undefined } {
    const { positioned, dragged } = this.takeOut(slots, tabId);
    return {
      slots: positioned.map(({ slot }) => slot),
      tab: dragged && !isStack(dragged) ? dragged : undefined,
    };
  }

  /** Takes a slot or a stack member out of the list, keeping each remaining slot's former index. */
  private takeOut(
    slots: TabList,
    id: TabId | StackId,
  ): { positioned: PositionedSlot[]; dragged: TabSlot | undefined } {
    let dragged: TabSlot | undefined;
    const positioned = slots.flatMap((slot, originalIndex): PositionedSlot[] => {
      if (slot.id === id) {
        dragged = slot;
        return [];
      }
      if (!isStack(slot)) return [{ slot, originalIndex }];
      const member = slot.tabs.find((tab) => tab.id === id);
      if (!member) return [{ slot, originalIndex }];
      dragged = member;
      const tabs = slot.tabs.filter((tab) => tab.id !== id);
      const currentTabId =
        slot.currentTabId === id
          ? (neighbourBefore(slot.tabs, slot.tabs.indexOf(member))?.id ?? slot.currentTabId)
          : slot.currentTabId;
      return this.normalizeStack({ ...slot, tabs, currentTabId }).map((slot) => ({
        slot,
        originalIndex,
      }));
    });
    return { positioned, dragged };
  }

  /** A stack as a slot while it has two members or more; otherwise what is left of it. */
  private normalizeStack(stack: TabStack): TabSlot[] {
    return stack.tabs.length >= 2 ? [stack] : stack.tabs;
  }

  private sameShape(a: TabList, b: TabList): boolean {
    if (a.length !== b.length) return false;
    return a.every((slot, index) => {
      const other = b[index];
      if (slot.id !== other.id || isStack(slot) !== isStack(other)) return false;
      if (!isStack(slot) || !isStack(other)) return true;
      return (
        slot.tabs.length === other.tabs.length &&
        slot.tabs.every((tab, tabIndex) => tab.id === other.tabs[tabIndex].id)
      );
    });
  }

  private findStack(slots: TabList, stackId: StackId): TabStack | undefined {
    const slot = slots.find((slot) => slot.id === stackId);
    return slot && isStack(slot) ? slot : undefined;
  }

  /** The shown workspace's stack holding `tabId`, if it is a member of one. */
  stackOfTab(tabId: TabId): TabStack | undefined {
    return this.stackOf(this.activeSlots(), tabId);
  }

  private stackOf(slots: TabList, tabId: TabId): TabStack | undefined {
    return slots.filter(isStack).find((stack) => stack.tabs.some((tab) => tab.id === tabId));
  }

  private getRequiredActiveWorkspaceIdentifier(): string {
    if (!this.activeWorkspaceIdentifier) {
      throw new Error("No active workspace found for tab list.");
    }
    return this.activeWorkspaceIdentifier;
  }

  /** The workspace holding `tabId`, shown or not; tab ids are unique across workspaces. */
  private workspaceOfTab(tabId: TabId): string | undefined {
    for (const [workspaceIdentifier, tabList] of this.tabListByWorkspaceIdentifier) {
      if (flatTabs(tabList).some((tab) => tab.id === tabId)) return workspaceIdentifier;
    }
    return undefined;
  }

  private getTabListForWorkspace(workspaceIdentifier: string): TabList {
    return this.tabListByWorkspaceIdentifier.get(workspaceIdentifier) ?? [];
  }

  private activeSlots(): TabList {
    return this.activeWorkspaceIdentifier
      ? this.getTabListForWorkspace(this.activeWorkspaceIdentifier)
      : [];
  }

  /** The shown workspace's tabs in bar order, members in place of their stack. */
  private activeTabs(): Tab[] {
    return flatTabs(this.activeSlots());
  }

  /**
   * Stores `tabList`: every writer builds a new list and new objects. The
   * member a stack stands for is settled here for all of them: its active
   * member, else the one it stood for while that is still a member, else the
   * first.
   */
  private setTabListForWorkspace(workspaceIdentifier: string, tabList: TabList): void {
    const settled = tabList.map((slot) =>
      isStack(slot) ? { ...slot, currentTabId: this.currentMemberOf(slot) } : slot,
    );
    this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, settled);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeTabsChanged.next();
    }
  }

  private currentMemberOf(stack: TabStack): TabId {
    return (
      stack.tabs.find((tab) => tab.isActive)?.id ??
      stack.tabs.find((tab) => tab.id === stack.currentTabId)?.id ??
      stack.tabs[0].id
    );
  }

  private updateTab(workspaceIdentifier: string, tabId: TabId, change: (tab: Tab) => Tab): void {
    const slots = this.getTabListForWorkspace(workspaceIdentifier);
    if (!flatTabs(slots).some((tab) => tab.id === tabId)) return;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      mapTabs(slots, (tab) => (tab.id === tabId ? change(tab) : tab)),
    );
  }

  private updateStack(
    workspaceIdentifier: string,
    stackId: StackId,
    change: (stack: TabStack) => TabStack,
  ): void {
    const slots = this.getTabListForWorkspace(workspaceIdentifier);
    if (!this.findStack(slots, stackId)) return;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      slots.map((slot) => (slot.id === stackId && isStack(slot) ? change(slot) : slot)),
    );
  }
}
