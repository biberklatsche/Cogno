import {Injectable} from "@angular/core";
import {Tab, TabList} from '../+model/tab';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {PaneConfig, TerminalConfig, GridConfig, TabId} from "../../workspace/+model/workspace";

@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabList: BehaviorSubject<TabList> = new BehaviorSubject<TabList>([]);

    get tabs$(): Observable<Tab[]> {
        return this._tabList.asObservable();
    }

    constructor(private bus: AppBus) {
        this.bus.onType$('WorkspaceLoaded').subscribe((event: WorkspaceLoadedEvent) => {
            this._tabList.next([]);
            for (const [index, grid] of event.payload!.grids.entries()) {
                const isActiveTab = index === 0;
                this.addTab({id: grid.tabId, title: 'Shell', activeShellType: 'unknown', isActive: isActiveTab});
            }
        });
    }

    addTab(tab: Tab) {
        const tabList = [...this._tabList.value];
        if(tabList.some(s => s.id === tab?.id)) return;
        for(const tab of tabList){
            tab.isActive = false;
        }
        tabList.push(tab);
        this._tabList.next(tabList);
        this.bus.publish({type: 'TabAddedEvent', payload: {tabId: tab.id}});
    }

    removeTab(tabId: TabId) {
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
        this.bus.publish({type: 'TabRemovedEvent', payload: tabId});
        if(nextActiveTab) {
            this.selectTab(nextActiveTab.id);
        }
    }

    selectTab(tabId: TabId) {
        const tabList = [...this._tabList.value];
        const tabIndex = tabList.findIndex(tab => tab.id === tabId);
        if(tabIndex === -1) return;
        for(const tab of tabList){
            tab.isActive = false;
        }
        tabList[tabIndex].isActive = true;
        this._tabList.next(tabList);
        this.bus.publish({type: 'TabSelectedEvent', payload: tabId});
    }
}
