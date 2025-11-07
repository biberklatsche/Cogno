import {Component, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabListService} from "./+state/tab-list.service";
import {Observable} from "rxjs";
import {IconComponent} from "../icons/icon/icon.component";
import {ShellType} from "../config/+models/config.types";
import {Icon} from "../icons/+model/icon";
import {TabId} from '../workspace/+model/workspace';
import {IdCreator} from '../common/id-creator/id-creator';
import {ContextMenuItem} from "../common/menu-overlay/menu-overlay.types";
import {MenuOverlayService} from "../common/menu-overlay/menu-overlay.service";
import {ContextMenuComponent} from "../common/menu-overlay/context-menu.component";
import {TabUi} from "./+model/tab";
@Component({
  selector: 'app-tab-list',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './tab-list.component.html',
  styleUrl: './tab-list.component.scss'
})
export class TabListComponent {

    tabs: Observable<TabUi[]>;
    showRename: WritableSignal<TabId | undefined> = signal(undefined);

    constructor(private tabListService: TabListService, private menu: MenuOverlayService) {
        this.tabs = this.tabListService.tabs$;
    }

    closeTab(tabId: TabId): void {
        this.tabListService.removeTab(tabId);
    }

    iconForShell(shell: ShellType | 'unknown'): Icon  {
        switch (shell) {
            case 'PowerShell':
                return 'mdiPowershell';
            case 'ZSH':
            case 'Bash':
            case 'GitBash':
            default:
                return 'mdiConsole';
        }
    }

    addTab() {
        this.tabListService.addTab({id: IdCreator.newTabId(), title: 'Shell', activeShellType: 'unknown', isActive: true});
    }

    selectTab(tabId: TabId) {
        this.tabListService.selectTab(tabId);
    }

    buildContextMenu(event: MouseEvent,tabId: TabId) {
        event.preventDefault();
        event.stopPropagation();
        const items: ContextMenuItem[] = this.tabListService.buildContextMenu(tabId);
        this.menu.openForElement(event.currentTarget as HTMLElement, ContextMenuComponent, { items });
    }
}
