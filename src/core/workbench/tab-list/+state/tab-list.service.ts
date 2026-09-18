import { DestroyRef, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
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
import { defaultWorkspaceIdContract, TabConfig, TabId } from "@cogno/shared/domain";
import { ActionKeybindingPort } from "@cogno/shared/ports";
import { ColorName, IdCreator } from "@cogno/shared/support";
import { ContextMenuItem } from "@cogno/shared/ui";
import { BehaviorSubject, Observable } from "rxjs";
import { Tab, TabList } from "../+model/tab";

@Injectable({ providedIn: "root" })
export class TabListService {
  private _tabList: BehaviorSubject<TabList> = new BehaviorSubject<TabList>([]);
  private _showRename: WritableSignal<TabId | undefined> = signal(undefined);
  private readonly tabListByWorkspaceIdentifier = new Map<string, TabList>();
  private activeWorkspaceIdentifier: string | undefined = defaultWorkspaceIdContract;

  get tabs$(): Observable<Tab[]> {
    return this._tabList.asObservable();
  }

  get showRename$(): Signal<TabId | undefined> {
    return this._showRename.asReadonly();
  }

  activateWorkspace(workspaceIdentifier: string): void {
    this.activeWorkspaceIdentifier = workspaceIdentifier;
    if (!this.tabListByWorkspaceIdentifier.has(workspaceIdentifier)) {
      this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, []);
    }
    this._showRename.set(undefined);
    this.emitActiveTabList();
  }

  removeWorkspaceRuntime(workspaceIdentifier: string): void {
    this.tabListByWorkspaceIdentifier.delete(workspaceIdentifier);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeWorkspaceIdentifier = undefined;
      this._showRename.set(undefined);
      this.emitActiveTabList();
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
          false,
          { shellName, workingDir: event.payload.workingDir },
        );
      });
    this.bus
      .on$("ChangeTabTitle")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: ChangeTabTitleEvent) => {
        const tabList = this.cloneTabList(this._tabList.value);
        const tab = tabList.find((s) => s.id === event.payload?.tabId);
        if (!tab || !event.payload?.title) return;
        tab.systemTitle = event.payload.title;
        this.setTabListForWorkspace(this.getRequiredActiveWorkspaceIdentifier(), tabList);
      });
    actions.handle("new_tab", (context) =>
      this.openShell(
        context.args?.[0] ?? this.configService.getShellProfileByShortcutIndex(1)?.name,
      ),
    );
    actions.handle("close_tab", () => {
      this.removeTab(this._tabList.value.find((tab) => tab.isActive)?.id);
    });
    actions.handle("select_next_tab", () => this.selectAdjacentTab(1));
    actions.handle("select_previous_tab", () => this.selectAdjacentTab(-1));
    actions.handle("close_other_tabs", () => {
      this.removeAllTabs(this._tabList.value.find((tab) => tab.isActive)?.id);
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
    const tab = this._tabList.value.find((tab) => tab.id === tabId);
    if (!tab) throw new Error("No tab found for TabList");
    const items: (ContextMenuItem | undefined)[] = [
      {
        label: actionLabel("close_tab"),
        action: () => this.removeTab(tabId),
        keybinding: this.keybindingFor("close_tab"),
      },
      this._tabList.value.length > 1
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
    const tabsToClose = [...this._tabList.value];
    if (!except) {
      this.setTabListForWorkspace(workspaceIdentifier, []);
    } else {
      const index = tabsToClose.findIndex((s) => s.id === except);
      const remainingTab = tabsToClose.splice(index, 1);
      this.setTabListForWorkspace(workspaceIdentifier, remainingTab);
    }
    for (const tab of tabsToClose) {
      this.bus.publish({ type: "TabRemoved", payload: tab.id });
    }
  }

  addTab(
    tab: Tab,
    silent: boolean = false,
    paneConfig?: { shellName?: string; workingDir?: string },
  ) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabList = this.cloneTabList(this._tabList.value);
    if (tabList.some((s) => s.id === tab?.id)) return;
    if (tab.isActive) {
      for (const other of tabList) {
        other.isActive = false;
      }
    }
    tabList.push(tab);
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
    if (silent) return;
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

  removeTab(tabId?: TabId) {
    if (!tabId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabList = this.cloneTabList(this._tabList.value);
    const tabIndex = tabList.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;
    const isActiveTab = tabList[tabIndex].isActive;
    tabList.splice(tabIndex, 1);
    let nextActiveTab: Tab | undefined;
    if (isActiveTab && tabList.length > 0) {
      nextActiveTab = tabList[Math.max(tabIndex - 1, 0)];
    }
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
    this.bus.publish({ type: "TabRemoved", payload: tabId });
    if (nextActiveTab) {
      this.selectTab(nextActiveTab.id);
    }
  }

  reorderTabs(sourceTabId: TabId, destinationTabId: TabId) {
    if (sourceTabId === destinationTabId) return;
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const reorderedTabList = this.cloneTabList(this._tabList.value);
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
    const tabList = this.cloneTabList(this._tabList.value);
    const tabIndex = tabList.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;
    for (const tab of tabList) {
      tab.isActive = false;
    }
    tabList[tabIndex].isActive = true;
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
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
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabList = this.cloneTabList(this._tabList.value);
    const tab = tabList.find((tab) => tab.id === tabId);
    if (!tab) return;
    tab.userTitle = value;
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
    this.closeRename();
  }

  resetTabName(tabId: TabId) {
    const workspaceIdentifier = this.getRequiredActiveWorkspaceIdentifier();
    const tabList = this.cloneTabList(this._tabList.value);
    const tab = tabList.find((tab) => tab.id === tabId);
    if (!tab?.userTitle) return;
    tab.userTitle = undefined;
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
  }

  setColor(tabId: TabId, name: ColorName | undefined) {
    const tabList = [...this._tabList.value];
    const tab = tabList.find((tab) => tab.id === tabId);
    if (!tab) return;
    tab.color = name;
    this.setTabListForWorkspace(this.getRequiredActiveWorkspaceIdentifier(), tabList);
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
    const activeTab = this._tabList.value.find((s) => s.isActive);
    if (activeTab) {
      this.bus.publish({ type: "FocusActiveTerminal" });
    }
  }

  private selectAdjacentTab(direction: 1 | -1): void {
    const tabs = this._tabList.value;
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
      false,
      { shellName },
    );
  }

  private selectTabByShortcutIndex(index: number): void {
    const tab = this._tabList.value[index - 1];
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

  private getTabListForWorkspace(workspaceIdentifier: string): TabList {
    return this.tabListByWorkspaceIdentifier.get(workspaceIdentifier) ?? [];
  }

  /**
   * The one place a tab list is cloned on its way in: callers may hand over
   * tabs they (or their callers) still hold, so the stored list is a copy.
   */
  private setTabListForWorkspace(workspaceIdentifier: string, tabList: TabList): void {
    this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, this.cloneTabList(tabList));
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.emitActiveTabList();
    }
  }

  private emitActiveTabList(): void {
    this._tabList.next(
      this.activeWorkspaceIdentifier
        ? this.getTabListForWorkspace(this.activeWorkspaceIdentifier)
        : [],
    );
  }

  private cloneTabList(tabList: TabList): TabList {
    return tabList.map((tab) => ({ ...tab }));
  }
}
