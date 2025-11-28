import {ChangeDetectionStrategy, Component, ElementRef, HostListener, Signal, ViewChild} from '@angular/core';
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
               [class.overlay]="!displacement()">
            <header>
                <div>
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
        <menu #menuCol>
            @for (menuItem of menuItems(); track menuItem) {
                @if (!menuItem.hidden) {
                    <button class="tab-list-btn" (click)="toggle(menuItem)"
                            [class.active]="selectedItem() === menuItem">
                        <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                    </button>
                }
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
            margin: 0 2px 0 2px;
            padding: 0;
            z-index: 3;
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
                right: 30px; /* leave room for the vertical menu buttons */
                top: 0;
                bottom: 0;

                max-height: 100%;
                overflow: auto;
            }

            header {
                display: flex;
                flex-direction: row;
                gap: 1rem;
                align-items: center;
            }
        }
    `]
})
export class SideMenuComponent {
    menuItems: Signal<SideMenuItem[]>;
    selectedItem = this.menuItemService.selectedItem;
    displacement = this.menuItemService.displacement;

    @ViewChild('overlayAside', {static: false}) overlayAsideRef?: ElementRef<HTMLElement>;
    @ViewChild('menuCol', {static: false}) menuColRef?: ElementRef<HTMLElement>;

    constructor(private menuItemService: SideMenuService) {
        this.menuItems = this.menuItemService.menu;
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
