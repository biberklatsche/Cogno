import {DestroyRef, Injectable, Signal, signal, WritableSignal} from "@angular/core";
import {Tab, TabList} from '../+model/tab';
import {BehaviorSubject, Observable} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {TabId} from "../../workspace/+model/workspace";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabTitleChangedEvent} from "../../terminal/+state/handler/tab-title.handler";
import {RemoveTabAction, SelectTabAction} from "../+bus/actions";
import {KeybindFiredEvent} from "../../keybinding/keybind.service";
import {ColorName, ContextMenuItem} from "../../common/menu-overlay/menu-overlay.types";
import {ConfigService} from "../../config/+state/config.service";
import {IdCreator} from "../../common/id-creator/id-creator";

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
        this.bus.onType$('WorkspaceLoaded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: WorkspaceLoadedEvent) => {
            this._tabList.next([]);
            for (const [index, grid] of event.payload!.grids.entries()) {
                this.addTab({id: grid.tabId, title: 'Shell', activeShellType: configService.config.shell?.["1"]?.shell_type ?? 'unknown', isActive: false});
            }
        });
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
        this.bus.on$({type: 'KeybindFired', path: ['app', 'keybind']}).pipe(takeUntilDestroyed(destroyRef)).subscribe((event: KeybindFiredEvent) => {
                switch (event.payload) {
                    case 'open_new_tab':
                        this.addTab({id: IdCreator.newTabId(), title: 'Shell', activeShellType: configService.config.shell?.["1"]?.shell_type ?? 'unknown', isActive: true});
                        event.performed = !event.trigger?.all;
                        event.defaultPrevented = true;
                        break;
                    case 'close_active_tab':
                        const activeTabId = this._tabList.value.find(s => s.isActive)?.id;
                        this.removeTab(activeTabId);
                        event.performed = !event.trigger?.all;
                        event.defaultPrevented = true;
                        break;
                    case 'close_other_tabs':
                        const activeTab = this._tabList.value.find(s => s.isActive);
                        this.closeAllTabs(activeTab?.id);
                        event.performed = !(event.trigger?.all);
                        event.defaultPrevented = true;
                        break;
                    case 'close_all_tabs':
                        this.closeAllTabs();
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
            this._tabList.value.length > 1 ?
                { label: 'Close other tabs', action: () => this.closeAllTabs(tabId), actionName: "close_other_tabs" }
                : undefined,
            { label: 'Close all tabs', action: () => this.closeAllTabs(), actionName: "split_down"  },
            {separator: true},
            { label: 'Rename tab', action: () => this._showRename.set(tabId)},
            {separator: true},
            { colorpicker: true, action: (color?: ColorName) => this.setColor(tabId, color), selectedColorName: tab.color?.name},
        ];
        return items.filter(s => !!s);
    }

    closeAllTabs(except?: TabId) {
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

    addTab(tab: Tab) {
        const tabList = [...this._tabList.value];
        if(tabList.some(s => s.id === tab?.id)) return;
        if(tab.isActive){
            for(const other of tabList){
                other.isActive = false;
            }
        }
        tabList.push(tab);
        this._tabList.next(tabList);
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
        if(!name) {
            tab.color = undefined;
        } else {
            tab.color = {hex: (this.configService.config.color as any)[name], name: name};
        }
        this._tabList.next(tabList);
    }
}
