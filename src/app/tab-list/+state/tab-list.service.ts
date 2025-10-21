import {Injectable} from "@angular/core";
import {Tab} from "../+model/tab";
import {BehaviorSubject, Observable} from "rxjs";
import {AppBus} from "../../app-bus/app-bus";
import {WorkspaceLoadedEvent} from "../../workspace/+bus/events";
import {NodeConfig, LeafNode, PaneConfig, TabId} from "../../workspace/+model/workspace";

@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabs: BehaviorSubject<Tab[]> = new BehaviorSubject<Tab[]>([]);
    get tabs$(): Observable<Tab[]> {
        return this._tabs.asObservable();
    }

    constructor(private bus: AppBus) {
        this.bus.onType$('WorkspaceLoaded').subscribe((event: WorkspaceLoadedEvent) => {
            for (let pane of event.payload!.panes) {
                this.addTab({id: pane.id, title: 'Shell', activeShellType: 'unknown'});
            }
        });
    }

    addTab(tabData: Partial<Tab>) {
        const tab: Tab = tabData as Tab;
        const tabs = [...this._tabs.value];

        if(tabs.find(t => t.id === tab.id)) return;
        tabs.push(tab);
        this._tabs.next(tabs);
    }

    removeTab(tab: Tab) {
        const tabs = [...this._tabs.value];
        const index = tabs.findIndex(t => t.id === tab.id);
        if(index === -1) return;
        tabs.splice(index, 1);
        this._tabs.next(tabs);
    }
}
