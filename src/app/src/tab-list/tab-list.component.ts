import {Component, ElementRef, OnDestroy, Signal, ViewChild, effect} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabListService} from "./+state/tab-list.service";
import {Observable} from "rxjs";
import {IconComponent} from "../icons/icon/icon.component";
import {ShellType} from "../config/+models/config";
import {Icon} from "../icons/+model/icon";
import {TabId} from "@cogno/core-sdk";
import {IdCreator} from '../common/id-creator/id-creator';
import {ContextMenuItem} from "../menu/context-menu-overlay/context-menu-overlay.types";
import {ContextMenuOverlayService} from "../menu/context-menu-overlay/context-menu-overlay.service";
import {Tab} from "./+model/tab";
import {AppMenuButtonComponent} from "../menu/app-menu/app-menu-button.component";
import {TooltipDirective} from "../common/tooltip/tooltip.directive";
import {ActionKeybindingPipe} from "../keybinding/pipe/keybinding.pipe";
import {StartEllipsisDirective} from "../common/text/start-ellipsis.directive";
import {DragPreviewService} from "../common/drag-preview/drag-preview.service";

@Component({
  selector: 'app-tab-list',
  standalone: true,
    imports: [CommonModule, IconComponent, AppMenuButtonComponent, TooltipDirective, ActionKeybindingPipe, StartEllipsisDirective],
  templateUrl: './tab-list.component.html',
  styleUrl: './tab-list.component.scss'
})
export class TabListComponent implements OnDestroy {

    private static readonly minimumDragStartDistanceInPixels = 4;

    tabs: Observable<Tab[]>;
    readonly showRename: Signal<TabId | undefined>;
    isDraggingTab = false;
    draggedTabIdentifier: TabId | undefined;

    private mouseDownTabIdentifier: TabId | undefined;
    private mouseDownClientX = 0;
    private mouseDownClientY = 0;
    private mouseDownTabRectangle: DOMRect | undefined;

    private readonly handleWindowMouseMove = (event: MouseEvent): void => this.onWindowMouseMove(event);
    private readonly handleWindowMouseUp = (event: MouseEvent): void => this.onWindowMouseUp(event);
    @ViewChild('renameInput') inputRef!: ElementRef<HTMLInputElement>;

    constructor(
        private tabListService: TabListService,
        private menu: ContextMenuOverlayService,
        private dragPreviewService: DragPreviewService
    ) {
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

    ngOnDestroy(): void {
        this.removeWindowPointerListeners();
        this.dragPreviewService.stopDragPreview();
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

    startTabReorderInteraction(event: MouseEvent, tabId: TabId): void {
        if (event.button !== 0 || this.showRename() === tabId) return;
        if (this.isInsideNonDraggableTabControl(event.target)) return;
        // Keep terminal focus while pressing and dragging a tab.
        event.preventDefault();
        this.isDraggingTab = false;
        this.draggedTabIdentifier = undefined;
        this.mouseDownTabIdentifier = tabId;
        this.mouseDownClientX = event.clientX;
        this.mouseDownClientY = event.clientY;
        const currentTargetElement = event.currentTarget;
        this.mouseDownTabRectangle = currentTargetElement instanceof HTMLElement
            ? currentTargetElement.getBoundingClientRect()
            : undefined;
        this.tabListService.focusActiveTerminal();
        this.addWindowPointerListeners();
    }

    reorderWhileDragging(targetTabIdentifier: TabId, event: MouseEvent): void {
        if (!this.isDraggingTab || event.buttons === 0 || !this.draggedTabIdentifier) return;
        if (this.draggedTabIdentifier === targetTabIdentifier) return;
        this.tabListService.reorderTabs(this.draggedTabIdentifier, targetTabIdentifier);
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

    private onWindowMouseMove(event: MouseEvent): void {
        if (this.isDraggingTab) {
            this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
            return;
        }
        if (!this.mouseDownTabIdentifier) return;
        const horizontalDistanceInPixels = Math.abs(event.clientX - this.mouseDownClientX);
        const verticalDistanceInPixels = Math.abs(event.clientY - this.mouseDownClientY);
        if (
            horizontalDistanceInPixels < TabListComponent.minimumDragStartDistanceInPixels
            && verticalDistanceInPixels < TabListComponent.minimumDragStartDistanceInPixels
        ) {
            return;
        }

        this.isDraggingTab = true;
        this.draggedTabIdentifier = this.mouseDownTabIdentifier;
        if (this.mouseDownTabRectangle) {
            this.dragPreviewService.startDragPreview(this.mouseDownTabRectangle, event.clientX, event.clientY);
        }
        this.dragPreviewService.updateDragPreviewPosition(event.clientX, event.clientY);
    }

    private onWindowMouseUp(event: MouseEvent): void {
        if (event.button !== 0) {
            this.mouseDownTabIdentifier = undefined;
            this.mouseDownTabRectangle = undefined;
            this.removeWindowPointerListeners();
            this.dragPreviewService.stopDragPreview();
            return;
        }

        const mouseDownTabIdentifier = this.mouseDownTabIdentifier;
        if (this.isDraggingTab) {
            this.isDraggingTab = false;
            this.draggedTabIdentifier = undefined;
            this.tabListService.focusActiveTerminal();
        } else if (mouseDownTabIdentifier) {
            this.tabListService.selectTab(mouseDownTabIdentifier);
            this.tabListService.focusActiveTerminal();
        }
        this.mouseDownTabIdentifier = undefined;
        this.mouseDownTabRectangle = undefined;
        this.removeWindowPointerListeners();
        this.dragPreviewService.stopDragPreview();
    }

    private addWindowPointerListeners(): void {
        window.addEventListener('mousemove', this.handleWindowMouseMove, true);
        window.addEventListener('mouseup', this.handleWindowMouseUp, true);
    }

    private removeWindowPointerListeners(): void {
        window.removeEventListener('mousemove', this.handleWindowMouseMove, true);
        window.removeEventListener('mouseup', this.handleWindowMouseUp, true);
    }

    private isInsideNonDraggableTabControl(eventTarget: EventTarget | null): boolean {
        if (!(eventTarget instanceof HTMLElement)) return false;
        return !!eventTarget.closest('.close, .inline-input');
    }
}
