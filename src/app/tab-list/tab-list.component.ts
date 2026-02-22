import {Component, ElementRef, Signal, ViewChild, effect} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabListService} from "./+state/tab-list.service";
import {Observable} from "rxjs";
import {IconComponent} from "../icons/icon/icon.component";
import {ShellType} from "../config/+models/config";
import {Icon} from "../icons/+model/icon";
import {TabId} from '../workspace/+model/workspace';
import {IdCreator} from '../common/id-creator/id-creator';
import {ContextMenuItem} from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import {Tab} from "./+model/tab";
import {AppMenuButtonComponent} from "../menu/app-menu/app-menu-button.component";
import {TooltipDirective} from "../common/tooltip/tooltip.directive";
import {ActionKeybindingPipe} from "../keybinding/pipe/keybinding.pipe";
import {StartEllipsisDirective} from "../common/text/start-ellipsis.directive";

@Component({
  selector: 'app-tab-list',
  standalone: true,
    imports: [CommonModule, IconComponent, AppMenuButtonComponent, TooltipDirective, ActionKeybindingPipe, StartEllipsisDirective],
  templateUrl: './tab-list.component.html',
  styleUrl: './tab-list.component.scss'
})
export class TabListComponent {

    tabs: Observable<Tab[]>;
    showRename: Signal<TabId | undefined>;
    @ViewChild('renameInput') inputRef!: ElementRef<HTMLInputElement>;

    constructor(private tabListService: TabListService, private menu: ContextMenuOverlayService) {
        this.tabs = this.tabListService.tabs$;
        this.showRename = this.tabListService.showRename$;

        // Focus the rename input when it appears
        effect(() => {
            const show = this.showRename();
            if (show) {
                // Wait for the view to render the input before focusing
                queueMicrotask(() => {
                    try {
                        const el = this.inputRef?.nativeElement;
                        if (el) {
                            el.focus();
                            el.select();
                        }
                    } catch {
                        // ignore if element is not yet available
                    }
                });
            }
        });
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

    closeTabMiddle(event: MouseEvent, tabId: TabId) {
        if (event.button === 1) {
            this.closeTab(tabId);
        }
    }

    buildContextMenu(event: MouseEvent,tabId: TabId) {
        event.preventDefault();
        event.stopPropagation();
        const items: ContextMenuItem[] = this.tabListService.buildContextMenu(tabId);
        this.menu.openContextForElement(event.currentTarget as HTMLElement, { items });
    }

    closeRename() {
        this.tabListService.closeRename();
    }

    commitRename(value: string) {
        this.tabListService.commitRename(value);
    }
}
