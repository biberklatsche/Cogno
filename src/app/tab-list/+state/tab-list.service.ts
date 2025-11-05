import {DestroyRef, Injectable} from "@angular/core";
import {Tab, TabList} from '../+model/tab';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {TabId} from "../../workspace/+model/workspace";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {TabTitleChangedEvent} from "../../terminal/+state/handler/tab-title.handler";
import {filter} from "rxjs/operators";
import {IdCreator} from "../../common/id-creator/id-creator";
import {RemoveTabAction, SelectTabAction} from "../+bus/actions";

@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabList: BehaviorSubject<TabList> = new BehaviorSubject<TabList>([]);

    get tabs$(): Observable<Tab[]> {
        return this._tabList.asObservable();
    }

    constructor(private bus: AppBus, destroyRef: DestroyRef) {
        this.bus.onType$('WorkspaceLoaded').pipe(takeUntilDestroyed(destroyRef)).subscribe((event: WorkspaceLoadedEvent) => {
            this._tabList.next([]);
            for (const [index, grid] of event.payload!.grids.entries()) {
                this.addTab({id: grid.tabId, title: 'Shell', activeShellType: 'unknown', isActive: false});
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
        this.bus.onType$('KeybindFired').subscribe(event => {
                switch (event.payload) {
                    case 'open_new_tab':
                        this.addTab({id: IdCreator.newTabId(), title: 'Shell', activeShellType: 'unknown', isActive: true});
                        event.performed = true;
                        break;
                    case 'close_active_tab':
                        const activeTabId = this._tabList.value.find(s => s.isActive)?.id;
                        this.removeTab(activeTabId);
                        event.performed = true;
                        break;
                }
            });
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
}
