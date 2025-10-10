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
            {'id': '2', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '3', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '4', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '5', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '6', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '7', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '8', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '9', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '10', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '11', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '12', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '13', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '14', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '15', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '16', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '17', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '18', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '19', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '20', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '21', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '22', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '23', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '24', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: false},
            {'id': '25', 'title': 'Tab 1 asdasöd kaslädk jasöldk jasöld kjws', 'shellType': 'Powershell', isSelected: true}])
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
