import {ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, Signal, ViewChild} from '@angular/core';
import {IconComponent} from "../../../icons/icon/icon.component";
import {SideMenuItem, SideMenuService} from "../+state/side-menu.service";
import {NgComponentOutlet} from "@angular/common";

@Component({
    selector: 'app-side-menu',
    imports: [
        IconComponent,
        NgComponentOutlet,
    ],
    host: {
        '[class.overlay-host]': '!displacement()'
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <aside #overlayAside class="base-overlay"
               [class.hidden]="!selectedItem()"
               [class.overlay]="!displacement()"
               [class.shift-left]="visibleItems().length > 0"
        >
            <header>
                <div class="btn-list">
                    <button class="tab-list-btn" (click)="close()">
                        <app-icon [name]="'mdiClose'"></app-icon>
                    </button>
                    <button class="tab-list-btn" (click)="toggleDisplacement()">
                        <app-icon [name]="displacement() ? 'mdiCropSquare' : 'mdiDotsSquare'"></app-icon>
                    </button>
                </div>
                <h3>{{ selectedItem()?.label }}</h3>
            </header>
            @if (selectedItem()?.component) {
                <ng-container *ngComponentOutlet="selectedItem()!.component"></ng-container>
            }
        </aside>
        <menu #menuCol [class.hidden]="visibleItems().length === 0">
            @for (menuItem of visibleItems(); track menuItem) {
                <button class="tab-list-btn" (click)="toggle(menuItem)"
                            [class.active]="selectedItem() === menuItem">
                    <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                </button>
            }
        </menu>`,
    styles: [`
        :host {
            display: flex;
            flex-direction: row;
            position: relative;
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
        }

        aside {
            width: max(33vw, 300px);
            margin-bottom: 4px;
            z-index: 2;

            &.hidden {
                display: none;
            }

            &.overlay {
                position: absolute;
                right: 4px; /* leave room for the vertical menu buttons */
                top: 2px;
                bottom: 0;

                max-height: 100%;
                overflow: auto;
            }
            
            &.shift-left {
                right: 32px;
            }

            header {
                display: flex;
                flex-direction: row;
                gap: 1rem;
                align-items: center;

                .btn-list {
                    display: flex;
                    flex-direction: row;
                    gap: 2px;
                }
            }
        }
    `]
})
export class SideMenuComponent {
    menuItems: Signal<SideMenuItem[]> = this.menuItemService.menu;
    visibleItems: Signal<SideMenuItem[]> = computed(() => this.menuItems().filter(i => !i.hidden));
    selectedItem = this.menuItemService.selectedItem;
    displacement = this.menuItemService.displacement;

    @ViewChild('overlayAside', {static: false}) overlayAsideRef?: ElementRef<HTMLElement>;
    @ViewChild('menuCol', {static: false}) menuColRef?: ElementRef<HTMLElement>;

    constructor(private menuItemService: SideMenuService) {
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Escape') return;
        this.menuItemService.close();
    }

    toggle(menuItem: SideMenuItem) {
        this.menuItemService.toggle(menuItem.label);
    }

    close() {
        this.menuItemService.close();
    }

    toggleDisplacement() {
        this.menuItemService.toggleDisplacement();
    }
}
