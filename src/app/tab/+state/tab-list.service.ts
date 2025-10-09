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
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '1', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: true}])
    }

    addTab(tab: Tab) {
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