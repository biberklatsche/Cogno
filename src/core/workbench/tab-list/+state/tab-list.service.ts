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
import { TabConfig, TabId } from "@cogno/core/workbench/grid-layout";
import { IdCreator } from "@cogno/core/workbench/id-creator";
import { defaultWorkspaceIdContract } from "@cogno/core/workbench/workspace/workspace-entry";
import { ColorName } from "@cogno/shared/support";
import { ContextMenuItem } from "@cogno/shared/ui";
import { BehaviorSubject, map, Observable } from "rxjs";
import { Tab, TabList } from "../+model/tab";

@Injectable({ providedIn: "root" })
export class TabListService {
  private _showRename: WritableSignal<TabId | undefined> = signal(undefined);
  /** The tabs of every workspace, shown or not; the only store. */
  private readonly tabListByWorkspaceIdentifier = new Map<string, TabList>();
  private activeWorkspaceIdentifier: string | undefined = defaultWorkspaceIdContract;
  /** Fires after every write that changes what the shown workspace lists. */
  private readonly activeTabsChanged = new BehaviorSubject<void>(undefined);

  /** The shown workspace's tabs; a new list on every write. */
  readonly tabs$: Observable<Tab[]> = this.activeTabsChanged.pipe(map(() => this.activeTabs()));

  get showRename$(): Signal<TabId | undefined> {
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
      actions.handle(`select_tab_${slot}`, () => this.selectTabByShortcutIndex(slot));
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

  private keybindingFor(actionName: ActionName): string {
    return this.keybindings.getKeybindingLabel(actionName);
  }

  removeAllTabs(except?: TabId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabs = this.activeTabs();
    const tabsToClose = tabs.filter((tab) => tab.id !== except);
    this.setTabListForWorkspace(
      workspaceIdentifier,
      tabs.filter((tab) => tab.id === except),
    );
    for (const tab of tabsToClose) {
      this.bus.publish({ type: "TabRemoved", payload: tab.id });
    }
  }

  /** Adds a copy of `tab` to the shown workspace; the caller keeps its own object. */
  addTab(tab: Tab, paneConfig?: { shellName?: string; workingDir?: string }) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabs = this.activeTabs();
    if (tabs.some((s) => s.id === tab?.id)) return;
    const others = tab.isActive ? tabs.map((other) => ({ ...other, isActive: false })) : tabs;
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
    const tabs = this.getTabListForWorkspace(workspaceIdentifier);
    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    const nextActiveTab =
      tabs[tabIndex].isActive && remaining.length > 0
        ? remaining[Math.max(tabIndex - 1, 0)]
        : undefined;
    const isShown = workspaceIdentifier === this.activeWorkspaceIdentifier;
    // A workspace in the background only notes its next active tab; selecting
    // it for real happens when the workspace is shown.
    this.setTabListForWorkspace(
      workspaceIdentifier,
      nextActiveTab && !isShown
        ? remaining.map((tab) => (tab === nextActiveTab ? { ...tab, isActive: true } : tab))
        : remaining,
    );
    this.bus.publish({ type: "TabRemoved", payload: tabId });
    if (nextActiveTab && isShown) {
      this.selectTab(nextActiveTab.id);
    }
  }

  reorderTabs(sourceTabId: TabId, destinationTabId: TabId) {
    if (sourceTabId === destinationTabId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const reorderedTabList = [...this.activeTabs()];
    const sourceTabIndex = reorderedTabList.findIndex((tab) => tab.id === sourceTabId);
    const destinationTabIndex = reorderedTabList.findIndex((tab) => tab.id === destinationTabId);
    if (sourceTabIndex === -1 || destinationTabIndex === -1) return;

    const [sourceTab] = reorderedTabList.splice(sourceTabIndex, 1);
    reorderedTabList.splice(destinationTabIndex, 0, sourceTab);
    this.setTabListForWorkspace(workspaceIdentifier, reorderedTabList);
  }

  selectTab(tabId: TabId) {
    if (this._showRename()) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabs = this.activeTabs();
    if (!tabs.some((tab) => tab.id === tabId)) return;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId })),
    );
    this.bus.publish({ type: "TabSelected", payload: tabId });
  }

  closeRename() {
    this._showRename.set(undefined);
    this.focusActiveTerminal();
  }

  commitRename(value: string) {
    if (!value?.trim()) return;
    const tabId = this._showRename();
    if (!tabId) return;
    this.updateTab(this.getRequiredActiveWorkspaceIdentifier(), tabId, (tab) => ({
      ...tab,
      userTitle: value,
    }));
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

  restoreTabs(tabConfigList: TabConfig[], workspaceIdentifier?: string) {
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    const tabs: TabList = tabConfigList.map((config) => {
      const tab: Tab = {
        id: config.tabId,
        color: config.color as ColorName | undefined,
        systemTitle: config.systemTitle ?? "Shell",
        userTitle: config.userTitle,
        isActive: config.isActive ?? false,
        activeShellType: "unknown",
      };
      return tab;
    });
    this.setTabListForWorkspace(targetWorkspaceIdentifier, tabs);
  }

  getTabConfigs(workspaceIdentifier?: string): TabConfig[] {
    const targetWorkspaceIdentifier =
      workspaceIdentifier ?? this.getRequiredActiveWorkspaceIdentifier();
    return this.getTabListForWorkspace(targetWorkspaceIdentifier).map<TabConfig>((tab) => ({
      tabId: tab.id,
      isActive: tab.isActive,
      color: tab.color,
      systemTitle: tab.systemTitle,
      userTitle: tab.userTitle,
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

  private selectTabByShortcutIndex(index: number): void {
    const tab = this.activeTabs()[index - 1];
    if (!tab) {
      return;
    }
    this.selectTab(tab.id);
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
      if (tabList.some((tab) => tab.id === tabId)) return workspaceIdentifier;
    }
    return undefined;
  }

  private getTabListForWorkspace(workspaceIdentifier: string): TabList {
    return this.tabListByWorkspaceIdentifier.get(workspaceIdentifier) ?? [];
  }

  private activeTabs(): TabList {
    return this.activeWorkspaceIdentifier
      ? this.getTabListForWorkspace(this.activeWorkspaceIdentifier)
      : [];
  }

  /** Stores `tabList` as it is: every writer builds a new list and new tab objects. */
  private setTabListForWorkspace(workspaceIdentifier: string, tabList: TabList): void {
    this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, tabList);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeTabsChanged.next();
    }
  }

  private updateTab(workspaceIdentifier: string, tabId: TabId, change: (tab: Tab) => Tab): void {
    const tabs = this.getTabListForWorkspace(workspaceIdentifier);
    if (!tabs.some((tab) => tab.id === tabId)) return;
    this.setTabListForWorkspace(
      workspaceIdentifier,
      tabs.map((tab) => (tab.id === tabId ? change(tab) : tab)),
    );
  }
}
