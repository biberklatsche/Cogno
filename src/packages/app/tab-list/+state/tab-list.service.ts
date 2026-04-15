import { DestroyRef, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { defaultWorkspaceIdContract, TabConfig, TabId } from "@cogno/core-api";
import { BehaviorSubject, Observable } from "rxjs";
import { ActionFired, ActionFiredEvent } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { ColorName } from "../../common/color/color";
import { IdCreator } from "../../common/id-creator/id-creator";
import { ConfigService } from "../../config/+state/config.service";
import { TabTitleChangedEvent } from "../../grid-list/+bus/events";
import { ContextMenuItem } from "../../menu/context-menu-overlay/context-menu-overlay.types";
import { CreateTabAction, RemoveTabAction, SelectTabAction } from "../+bus/actions";
import { Tab, TabList } from "../+model/tab";

@Injectable({ providedIn: "root" })
export class TabListService {
  private static readonly indexedShortcutLimit = 9;

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
    this._tabList.next(this.cloneTabList(this.getTabListForWorkspace(workspaceIdentifier)));
  }

  moveActiveWorkspaceRuntime(targetWorkspaceIdentifier: string): void {
    const sourceWorkspaceIdentifier = this.activeWorkspaceIdentifier;
    if (!sourceWorkspaceIdentifier || sourceWorkspaceIdentifier === targetWorkspaceIdentifier) {
      this.activateWorkspace(targetWorkspaceIdentifier);
      return;
    }

    const currentTabList = this.cloneTabList(
      this.getTabListForWorkspace(sourceWorkspaceIdentifier),
    );
    this.tabListByWorkspaceIdentifier.set(targetWorkspaceIdentifier, currentTabList);
    this.tabListByWorkspaceIdentifier.delete(sourceWorkspaceIdentifier);
    this.activeWorkspaceIdentifier = targetWorkspaceIdentifier;
    this._tabList.next(this.cloneTabList(currentTabList));
  }

  removeWorkspaceRuntime(workspaceIdentifier: string): void {
    this.tabListByWorkspaceIdentifier.delete(workspaceIdentifier);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this.activeWorkspaceIdentifier = undefined;
      this._showRename.set(undefined);
      this._tabList.next([]);
    }
  }

  constructor(
    private bus: AppBus,
    private readonly configService: ConfigService,
    destroyRef: DestroyRef,
  ) {
    this.bus
      .onType$("SelectTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: SelectTabAction) => {
        this.selectTab(event.payload!);
        event.propagationStopped = true;
      });
    this.bus
      .onType$("RemoveTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: RemoveTabAction) => {
        this.removeTab(event.payload);
        event.propagationStopped = true;
      });
    this.bus
      .onType$("CreateTab")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: CreateTabAction) => {
        if (!event.payload?.tabId) return;
        const shellName = event.payload.shellName;
        this.addTab(
          {
            id: event.payload.tabId,
            title: event.payload.title ?? "Shell",
            activeShellType: configService.getShellProfileOrDefault(shellName).shell_type,
            isActive: event.payload.isActive ?? true,
          },
          false,
          { shellName, workingDir: event.payload.workingDir },
        );
        event.propagationStopped = true;
      });
    this.bus
      .onType$("TabTitleChanged")
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: TabTitleChangedEvent) => {
        const tabList = this.cloneTabList(this._tabList.value);
        const tab = tabList.find((s) => s.id === event.payload?.tabId);
        if (!tab || tab.isTitleLocked || !event.payload?.title) return;
        tab.title = event.payload.title;
        this.setTabListForWorkspace(this.getRequiredActiveWorkspaceIdentifier(), tabList);
        event.propagationStopped = true;
      });
    this.bus
      .on$(ActionFired.listener())
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event: ActionFiredEvent) => {
        if (!event.payload) {
          return;
        }

        const shellIndex = this.resolveShortcutIndex(event.payload, "open_shell_");
        if (shellIndex !== undefined) {
          this.openShell(this.configService.getShellProfileByShortcutIndex(shellIndex)?.name);
          event.performed = !event.trigger?.all;
          event.defaultPrevented = true;
          return;
        }

        const tabIndex = this.resolveShortcutIndex(event.payload, "select_tab_");
        if (tabIndex !== undefined) {
          this.selectTabByShortcutIndex(tabIndex);
          event.performed = !event.trigger?.all;
          event.defaultPrevented = true;
          return;
        }

        switch (event.payload) {
          case "new_tab":
            this.openShell(
              event.args?.[0] ?? this.configService.getShellProfileByShortcutIndex(1)?.name,
            );
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
          case "close_tab": {
            const activeTabId = this._tabList.value.find((s) => s.isActive)?.id;
            this.removeTab(activeTabId);
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
          }
          case "select_next_tab":
            this.selectAdjacentTab(1);
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
          case "select_previous_tab":
            this.selectAdjacentTab(-1);
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
          case "close_other_tabs": {
            const activeTab = this._tabList.value.find((s) => s.isActive);
            this.removeAllTabs(activeTab?.id);
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
          }
          case "close_all_tabs":
            this.removeAllTabs();
            event.performed = !event.trigger?.all;
            event.defaultPrevented = true;
            break;
        }
      });
  }

  buildContextMenu(tabId: TabId): ContextMenuItem[] {
    const tab = this._tabList.value.find((tab) => tab.id === tabId);
    if (!tab) throw new Error("No tab found for TabList");
    const items: (ContextMenuItem | undefined)[] = [
      { label: "Close tab", action: () => this.removeTab(tabId), actionName: "close_tab" },
      this._tabList.value.length > 1
        ? {
            label: "Close other tabs",
            action: () => this.removeAllTabs(tabId),
            actionName: "close_other_tabs",
          }
        : undefined,
      { label: "Close all tabs", action: () => this.removeAllTabs(), actionName: "close_all_tabs" },
      { separator: true },
      { label: "Rename tab", action: () => this._showRename.set(tabId) },
      { separator: true },
      {
        colorpicker: true,
        action: (color?: ColorName) => this.setColor(tabId, color),
        selectedColorName: tab.color,
      },
    ];
    return items.filter((s) => !!s);
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
    tab.title = value;
    tab.isTitleLocked = true;
    this.setTabListForWorkspace(workspaceIdentifier, tabList);
    this.bus.publish({ type: "TabRenamed", payload: { tabId: tab.id, title: tab.title } });
    this.closeRename();
  }

  private setColor(tabId: TabId, name: ColorName | undefined) {
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
        title: config.title ?? "Shell",
        isTitleLocked: config.isTitleLocked ?? false,
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
      title: tab.title,
      isTitleLocked: tab.isTitleLocked ?? false,
    }));
  }

  focusActiveTerminal() {
    const activeTab = this._tabList.value.find((s) => s.isActive);
    if (activeTab) {
      this.bus.publish({ type: "FocusActiveTerminal", path: ["app", "terminal"] });
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
        title: "Shell",
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

  private resolveShortcutIndex(actionName: string, prefix: string): number | undefined {
    if (!actionName.startsWith(prefix)) {
      return undefined;
    }
    const index = Number.parseInt(actionName.slice(prefix.length), 10);
    if (Number.isNaN(index) || index < 1 || index > TabListService.indexedShortcutLimit) {
      return undefined;
    }
    return index;
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

  private setTabListForWorkspace(workspaceIdentifier: string, tabList: TabList): void {
    const clonedTabList = this.cloneTabList(tabList);
    this.tabListByWorkspaceIdentifier.set(workspaceIdentifier, clonedTabList);
    if (this.activeWorkspaceIdentifier === workspaceIdentifier) {
      this._tabList.next(this.cloneTabList(clonedTabList));
    }
  }

  private cloneTabList(tabList: TabList): TabList {
    return tabList.map((tab) => ({ ...tab }));
  }
}
