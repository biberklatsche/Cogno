import {
    ChangeDetectionStrategy,
    Component,
    computed,
    EffectRef,
    effect,
    ElementRef,
    OnDestroy,
    Signal,
    ViewChild,
} from '@angular/core';
import { IconComponent } from "@cogno/core-ui";
import {SideMenuItem, SideMenuService} from "../+state/side-menu.service";
import {NgComponentOutlet} from "@angular/common";
import {TooltipDirective} from "../../../common/tooltip/tooltip.directive";
import {ActionKeybindingPipe} from "../../../keybinding/pipe/keybinding.pipe";

@Component({
    selector: 'app-side-menu',
    imports: [
        IconComponent,
        NgComponentOutlet,
        TooltipDirective,
        ActionKeybindingPipe,
    ],
    host: {
        '[class.overlay-host]': '!overlay()'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside #overlayAside class="base-overlay"
               [class.hidden]="!selectedItem()"
               [class.overlay]="!overlay()"
               [class.shift-left]="visibleItems().length > 0"
               [style.width.px]="panelWidthInPixels()"
               tabindex="-1"
               (pointerdown)="focus()"
        >
            <div class="resize-handle" (pointerdown)="startResize($event)"></div>
            <header>
                <h3>{{ selectedItem()?.label }}</h3>
                <div class="btn-list">
                    <button class="button icon-button" (click)="togglePin()">
                        <app-icon [name]="selectedItem()?.pinned ? 'mdiPinOff' : 'mdiPin'"></app-icon>
                    </button>
                    <button class="button icon-button" (click)="toggleDisplacement()">
                        <app-icon [name]="overlay() ? 'mdiCropSquare' : 'mdiDotsSquare'"></app-icon>
                    </button>
                    <button class="button icon-button" (click)="close()">
                        <app-icon [name]="'mdiClose'"></app-icon>
                    </button>
                </div>
            </header>
            <main>
                @if (selectedItem()?.component) {
                    <ng-container *ngComponentOutlet="selectedItem()!.component"></ng-container>
                }
            </main>
        </aside>
        <menu #menuCol [class.hidden]="visibleItems().length === 0">
            @for (menuItem of visibleItems(); track menuItem) {
                <button class="button icon-button" (click)="open(menuItem)"
                        [class.selected]="selectedItem() === menuItem" [appTooltip]="menuItem.label" [appTooltipSecondary]="menuItem.actionName | actionkeybinding">
                    <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                    @if (menuItem.badgeColor) {
                        <span class="badge" [style.background-color]="menuItem.badgeColor"></span>
                    }
                </button>
            }
        </menu>`,
    styles: [`
        :host {
            display: flex;
            flex-direction: row;
            position: relative;
            min-height: 0;
        }

        h3 {
            font-weight: normal;
            opacity: 0.7;
        }

        menu {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin: 2px 4px 0 2px;
            padding: 0;
            z-index: 3;
            &.hidden {
                margin: 0;
            }

            .button.icon-button.selected {
                background-color: var(--background-color-10l);
            }

            .button {
                position: relative;
            }

            .badge {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                border: 1px solid var(--background-color);
            }
        }

        aside {
            margin-bottom: 4px;
            z-index: 2;
            display: flex;
            flex-direction: column;
            max-height: 100%;
            min-width: 0;

            &.hidden {
                display: none;
            }

            &.overlay {
                position: absolute;
                right: 4px; 
                top: 2px;
                bottom: 0;

                max-height: 100%;
                overflow: hidden;
            }
            
            &.shift-left {
                right: 32px;
            }

            .resize-handle {
                position: absolute;
                top: 0;
                bottom: 0;
                left: -4px;
                width: 8px;
                cursor: ew-resize;
                z-index: 2;
            }

            header {
                display: flex;
                flex-direction: row;
                gap: 1rem;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 1;

                h3 {
                    flex: 1 1 auto;
                    min-width: 0;
                }

                .btn-list {
                    display: flex;
                    flex-direction: row;
                    gap: 2px;
                    margin-left: auto;
                }
            }
            
            main {
                padding: 0.5rem;
                flex: 1 1 auto;
                overflow: hidden;
                min-height: 0;
            }

            main > * {
                min-height: 0;
                max-height: 100%;
            }

            main :where(ul) {
                overflow: auto;
                max-height: 100%;
                min-height: 0;
            }
        }
    `]
})
export class SideMenuComponent implements OnDestroy {
    menuItems: Signal<SideMenuItem[]> = this.menuItemService.menu;
    visibleItems: Signal<SideMenuItem[]> = computed(() => {
        return this.menuItems()
            .filter((menuItem) => !menuItem.hidden)
            .slice()
            .sort((leftMenuItem, rightMenuItem) => (leftMenuItem.order ?? 0) - (rightMenuItem.order ?? 0));
    });
    selectedItem = this.menuItemService.selectedItem;
    overlay = this.menuItemService.displacement;
    focused = this.menuItemService.isFocused;
    panelWidthInPixels = this.menuItemService.panelWidthInPixels;

    @ViewChild('overlayAside', {static: false}) overlayAsideRef?: ElementRef<HTMLElement>;
    @ViewChild('menuCol', {static: false}) menuColRef?: ElementRef<HTMLElement>;

    private clickOutsideEffect: EffectRef;
    private lastOpenTimestamp = 0;
    private resizeStartPointerClientX = 0;
    private resizeStartPanelWidthInPixels = 0;

    constructor(private menuItemService: SideMenuService) {
        this.clickOutsideEffect = effect(() => {
            const isOpen = !!this.selectedItem();
            const isFocused = this.focused();

            if (isOpen && isFocused) {
                this.lastOpenTimestamp = performance.now();
                document.addEventListener('pointerdown', this.onPointerDown, true);
            } else {
                document.removeEventListener('pointerdown', this.onPointerDown, true);
            }
        });

        effect(() => {
            const isOpen = !!this.selectedItem();
            const isFocused = this.focused();
            if (!isOpen || !isFocused) return;
            queueMicrotask(() => this.overlayAsideRef?.nativeElement.focus());
        });
    }

    ngOnDestroy() {
        document.removeEventListener('pointerdown', this.onPointerDown, true);
        window.removeEventListener('pointermove', this.onWindowPointerMove, true);
        window.removeEventListener('pointerup', this.onWindowPointerUp, true);
        this.clickOutsideEffect.destroy();
    }

    private onPointerDown = (ev: PointerEvent) => {
        // Ignore the very event that triggered open
        if (Math.abs(ev.timeStamp - this.lastOpenTimestamp) < 10) return;

        const target = ev.target as Node;
        const targetElement = target instanceof Element ? target : null;
        const clickedInsideDialog = !!targetElement?.closest('app-dialog');
        if (clickedInsideDialog) return;

        const clickedInsideAside = this.overlayAsideRef?.nativeElement.contains(target);
        const clickedInsideMenu = this.menuColRef?.nativeElement.contains(target);

        if (!clickedInsideAside && !clickedInsideMenu) {
            if (this.selectedItem()?.pinned) {
                this.menuItemService.blur();
                return;
            }
            this.close();
        }
    };

    open(menuItem: SideMenuItem) {
        this.menuItemService.open(menuItem.label);
    }

    close() {
        this.menuItemService.close(true);
    }

    focus() {
        this.menuItemService.focus();
    }

    toggleDisplacement() {
        this.menuItemService.toggleDisplacement();
    }

    togglePin() {
        this.menuItemService.togglePin();
    }

    startResize(pointerEvent: PointerEvent): void {
        pointerEvent.preventDefault();
        pointerEvent.stopPropagation();
        this.resizeStartPointerClientX = pointerEvent.clientX;
        this.resizeStartPanelWidthInPixels = this.panelWidthInPixels();
        window.addEventListener('pointermove', this.onWindowPointerMove, true);
        window.addEventListener('pointerup', this.onWindowPointerUp, true);
    }

    private onWindowPointerMove = (pointerEvent: PointerEvent): void => {
        const horizontalDeltaInPixels = this.resizeStartPointerClientX - pointerEvent.clientX;
        this.menuItemService.setPanelWidthInPixels(this.resizeStartPanelWidthInPixels + horizontalDeltaInPixels);
    };

    private onWindowPointerUp = (): void => {
        window.removeEventListener('pointermove', this.onWindowPointerMove, true);
        window.removeEventListener('pointerup', this.onWindowPointerUp, true);
    };
}
