import {Injectable} from "@angular/core";
import {Tab, TabList} from '../+model/tab';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {NodeConfig, LeafNode, PaneConfig, TabId} from "../../workspace/+model/workspace";

@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabList: BehaviorSubject<TabList> = new BehaviorSubject<TabList>([]);

    get tabs$(): Observable<Tab[]> {
        return this._tabList.asObservable();
    }

    constructor(private bus: AppBus) {
        this.bus.onType$('WorkspaceLoaded').subscribe((event: WorkspaceLoadedEvent) => {
            for (const [index, pane] of event.payload!.panes.entries()) {
                const isActiveTab = index === 0;
                this.addTab({id: pane.id, title: 'Shell', activeShellType: 'unknown', isActive: isActiveTab});
                if(isActiveTab) {
                    this.selectTab(pane.id)
                }
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
    }

    removeTab(tabId: TabId) {
        const tabList = [...this._tabList.value];
        const tabIndex = tabList.findIndex(tab => tab.id === tabId);
        if(tabIndex === -1) return;
        const isActiveTab = tabList[tabIndex].isActive;
        tabList.splice(tabIndex, 1);
        if(isActiveTab && tabList.length > 0) {
           tabList[Math.max(tabIndex - 1, 0)].isActive = true;
        }
        this._tabList.next(tabList);
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
    }
}
