import {Injectable} from "@angular/core";
import {Tab} from "../+model/tab";
import {BehaviorSubject, Observable} from "rxjs";

@Injectable({providedIn: 'root'})
export class TabListService {

    private _tabs: BehaviorSubject<Tab[]> = new BehaviorSubject<Tab[]>([]);
    get tabs$(): Observable<Tab[]> {
        return this._tabs.asObservable();
    }

    constructor() {
        this._tabs.next([
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false}
        ]);
    }

    addTab(tabData: Partial<Tab>) {
        if(!tabData.id) {
            tabData.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        }
        if(!tabData.title) {
            tabData.title = 'Tab 1';
        }
        if(!tabData.shellType) {
            tabData.shellType = 'Powershell';
        }

        console.log('#####', tabData)

        const tab: Tab = tabData as Tab;
        const tabs = [...this._tabs.value];

        console.log('#####', tabs.find(t => t.id === tab.id))

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
