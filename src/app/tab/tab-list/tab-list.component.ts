import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabListService} from "../+state/tab-list.service";
import {Tab} from "../+model/tab";
import {Observable} from "rxjs";
import {IconComponent} from "../../icons/icon/icon.component";
import {ShellType} from "../../config/+models/config";
import {Icon} from "../../icons/+model/icon";
import {AppBus} from "../../app-bus/app-bus";
@Component({
  selector: 'app-tab-list',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './tab-list.component.html',
  styleUrl: './tab-list.component.scss'
})
export class TabListComponent {

    tabs: Observable<Tab[]>;

    constructor(private tabListService: TabListService) {
        this.tabs = this.tabListService.tabs$;
    }

    closeTab(tab: Tab): void {
        this.tabListService.removeTab(tab);
    }

    iconForShell(shell: ShellType): Icon  {
        switch (shell) {
            case 'Powershell':
                return 'mdiPowershell';
            case 'ZSH':
            case 'Bash':
            case 'GitBash':
            default:
                return 'mdiConsole';
        }
    }

    addTab() {
        this.tabListService.addTab({});
    }
}
