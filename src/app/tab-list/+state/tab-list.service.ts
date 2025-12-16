import {DestroyRef, Injectable, Signal, signal, WritableSignal} from "@angular/core";
import {Tab, TabList} from '../+model/tab';
import {BehaviorSubject, Observable} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {TabConfig, TabId} from "../../workspace/+model/workspace";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabTitleChangedEvent} from "../../terminal/+state/handler/tab-title.handler";
import {RemoveTabAction, SelectTabAction} from "../+bus/actions";
import {ContextMenuItem} from "../../menu/context-menu-overlay/context-menu-overlay.types";
import {ConfigService} from "../../config/+state/config.service";
import {IdCreator} from "../../common/id-creator/id-creator";
import {ActionFired, ActionFiredEvent} from "../../action/action.models";
import {ColorName} from "../../common/color/color";


@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabList: BehaviorSubject<TabList> = new BehaviorSubject<TabList>([]);
    private _showRename: WritableSignal<TabId | undefined> = signal(undefined);

    get tabs$(): Observable<Tab[]> {
        return this._tabList.asObservable();
    }

    get showRename$(): Signal<TabId | undefined> {
        return this._showRename.asReadonly();
    }

    constructor(private bus: AppBus, private configService: ConfigService, destroyRef: DestroyRef) {
        this.bus.onType$('SelectTab').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: SelectTabAction) => {
            this.selectTab(event.payload!);
            event.propagationStopped = true;
        });
        this.bus.onType$('RemoveTab').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: RemoveTabAction) => {
            this.removeTab(event.payload);
            event.propagationStopped = true;
        });
        this.bus.onType$('TabTitleChanged').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: TabTitleChangedEvent) => {
            const tabList = [...this._tabList.value];
            const tab = tabList.find(s => s.id === event.payload?.terminalId);
            if(!tab || !event.payload?.title) return;
            tab.title = event.payload.title;
            this._tabList.next(tabList);
            event.propagationStopped = true;
        });
        this.bus.on$(ActionFired.listener())
            .pipe(takeUntilDestroyed(destroyRef))
            .subscribe((event: ActionFiredEvent) => {
                switch (event.payload) {
                    case 'new_tab':
                        this.addTab({id: IdCreator.newTabId(), title: 'Shell', activeShellType: configService.config.shell?.["1"]?.shell_type ?? 'unknown', isActive: true});
                        event.performed = !event.trigger?.all;
                        event.defaultPrevented = true;
                        break;
                    case 'close_tab':
                        const activeTabId = this._tabList.value.find(s => s.isActive)?.id;
                        this.removeTab(activeTabId);
                        event.performed = !event.trigger?.all;
                        event.defaultPrevented = true;
                        break;
                    case 'close_other_tabs':
                        const activeTab = this._tabList.value.find(s => s.isActive);
                        this.removeAllTabs(activeTab?.id);
                        event.performed = !(event.trigger?.all);
                        event.defaultPrevented = true;
                        break;
                    case 'close_all_tabs':
                        this.removeAllTabs();
                        event.performed = !event.trigger?.all;
                        event.defaultPrevented = true;
                        break;

                }
            });
    }

    buildContextMenu(tabId: TabId): ContextMenuItem[] {
        const tab = this._tabList.value.find(tab => tab.id === tabId);
        if(!tab) throw new Error("No tab found for TabList");
        const items: (ContextMenuItem|undefined)[] = [
            { label: 'Close tab', action: () => this.removeTab(tabId), actionName: "close_tab"  },
            this._tabList.value.length > 1 ?
                { label: 'Close other tabs', action: () => this.removeAllTabs(tabId), actionName: "close_other_tabs" }
                : undefined,
            { label: 'Close all tabs', action: () => this.removeAllTabs(), actionName: "close_all_tabs"  },
            {separator: true},
            { label: 'Rename tab', action: () => this._showRename.set(tabId)},
            {separator: true},
            { colorpicker: true, action: (color?: ColorName) => this.setColor(tabId, color), selectedColorName: tab.color},
        ];
        return items.filter(s => !!s);
    }

    removeAllTabs(except?: TabId) {
        const tabsToClose = [...this._tabList.value];
        if(!except) {
            this._tabList.next([]);
        } else {
            const index = tabsToClose.findIndex(s => s.id === except);
            const remainingTab = tabsToClose.splice(index, 1);
            this._tabList.next(remainingTab);
        }
        for (const tab of tabsToClose) {
            this.bus.publish({type: 'TabRemoved', payload: tab.id});
        }
    }

    addTab(tab: Tab, silent: boolean = false) {
        const tabList = [...this._tabList.value];
        if(tabList.some(s => s.id === tab?.id)) return;
        if(tab.isActive){
            for(const other of tabList){
                other.isActive = false;
            }
        }
        tabList.push(tab);
        this._tabList.next(tabList);
        if(silent) return;
        this.bus.publish({type: 'TabAdded', payload: {tabId: tab.id, isActive: tab.isActive}});
    }

    removeTab(tabId?: TabId) {
        if(!tabId) return;
        const tabList = [...this._tabList.value];
        const tabIndex = tabList.findIndex(tab => tab.id === tabId);
        if(tabIndex === -1) return;
        const isActiveTab = tabList[tabIndex].isActive;
        tabList.splice(tabIndex, 1);
        let nextActiveTab;
        if(isActiveTab && tabList.length > 0) {
           nextActiveTab = tabList[Math.max(tabIndex - 1, 0)];
        }
        this._tabList.next(tabList);
        this.bus.publish({type: 'TabRemoved', payload: tabId});
        if(nextActiveTab) {
            this.selectTab(nextActiveTab.id);
        }
    }

    selectTab(tabId: TabId) {
        if(this._showRename()) return;
        const tabList = [...this._tabList.value];
        const tabIndex = tabList.findIndex(tab => tab.id === tabId);
        if(tabIndex === -1) return;
        for(const tab of tabList){
            tab.isActive = false;
        }
        tabList[tabIndex].isActive = true;
        this._tabList.next(tabList);
        this.bus.publish({type: 'TabSelected', payload: tabId});
    }

    closeRename() {
        this._showRename.set(undefined);
        const activeTab = this._tabList.value.find(s => s.isActive);
        if(activeTab) {
            this.bus.publish({type: "FocusActiveTerminal", path: ['app', 'terminal']});
        }
    }

    commitRename(value: string) {
        if(!value?.trim()) return;
        const tabId = this._showRename();
        if(!tabId) return;
        const tabList = [...this._tabList.value];
        const tab = tabList.find(tab => tab.id === tabId);
        if(!tab) return;
        tab.title = value;
        this._tabList.next(tabList);
        this.closeRename();
    }

    private setColor(tabId: TabId, name: ColorName | undefined) {
        const tabList = [...this._tabList.value];
        const tab = tabList.find(tab => tab.id === tabId);
        if(!tab) return;
        tab.color = name;
        this._tabList.next(tabList);
    }

    restoreTabs(tabConfigList: TabConfig[]) {
        if(tabConfigList.length === 0) this._tabList.next([]);
        const tabs: TabList = tabConfigList.map(config => {
            const tab: Tab = {
                id: config.tabId,
                color: config.color,
                title: config.title ?? 'Shell',
                isActive: config.isActive ?? false,
                activeShellType: 'unknown'
            }
            return tab
        });
        this._tabList.next(tabs);
    }
}
