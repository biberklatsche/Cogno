import {ChangeDetectionStrategy, Component, computed, ElementRef, Signal, ViewChild, effect, OnDestroy} from '@angular/core';
import {IconComponent} from "../../../icons/icon/icon.component";
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
        >
            <header>
                <div class="btn-list">
                    <button class="tab-list-btn" (click)="close()">
                        <app-icon [name]="'mdiClose'"></app-icon>
                    </button>
                    <button class="tab-list-btn" (click)="togglePin()">
                        <app-icon [name]="selectedItem()?.pinned ? 'mdiPinOff' : 'mdiPin'"></app-icon>
                    </button>
                    <button class="tab-list-btn" (click)="toggleDisplacement()">
                        <app-icon [name]="overlay() ? 'mdiCropSquare' : 'mdiDotsSquare'"></app-icon>
                    </button>
                </div>
                <h3>{{ selectedItem()?.label }}</h3>
            </header>
            <main>
                @if (selectedItem()?.component) {
                    <ng-container *ngComponentOutlet="selectedItem()!.component"></ng-container>
                }
            </main>
        </aside>
        <menu #menuCol [class.hidden]="visibleItems().length === 0">
            @for (menuItem of visibleItems(); track menuItem) {
                <button class="tab-list-btn" (click)="open(menuItem)"
                        [class.active]="selectedItem() === menuItem" [appTooltip]="menuItem.label" [appTooltipSecondary]="menuItem.actionName | actionkeybinding">
                    <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
                </button>
            }
        </menu>`,
    styles: [`
        :host {
            display: flex;
            flex-direction: row;
            position: relative;
            /* wichtig, damit Kinder in Flex-Layouts korrekt schrumpfen können */
            min-height: 0;
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
            margin-bottom: 4px;
            z-index: 2;
            /* Layout: Header fixieren, Content füllt Rest */
            display: flex;
            flex-direction: column;
            max-height: 100%;

            &.hidden {
                display: none;
            }

            &.overlay {
                position: absolute;
                right: 4px; /* leave room for the vertical menu buttons */
                top: 2px;
                bottom: 0;

                max-height: 100%;
                /* der Aside-Container selbst soll nicht scrollen */
                overflow: hidden;
            }
            
            &.shift-left {
                right: 32px;
            }

            header {
                display: flex;
                flex-direction: row;
                gap: 1rem;
                align-items: center;
                /* Header bleibt stets sichtbar */
                position: sticky;
                top: 0;
                z-index: 1;

                .btn-list {
                    display: flex;
                    flex-direction: row;
                    gap: 2px;
                }
            }
            
            main {
                padding: 0.5rem;
                /* Main nimmt den verfügbaren Platz ein, scrollt selbst nicht */
                flex: 1 1 auto;
                overflow: hidden;
                min-height: 0;
            }

            /* Direkte Kinder im Main sollen schrumpfen dürfen und eigenen Scroll übernehmen */
            main > * {
                min-height: 0;
                max-height: 100%;
            }

            /* Command-Palette: ul innerhalb des Mains scrollt bei Overflow */
            main :where(ul) {
                overflow: auto;
                max-height: 100%;
                min-height: 0;
            }
        }
    `]
})
export class SideMenuComponent {
    menuItems: Signal<SideMenuItem[]> = this.menuItemService.menu;
    visibleItems: Signal<SideMenuItem[]> = computed(() => this.menuItems().filter(i => !i.hidden));
    selectedItem = this.menuItemService.selectedItem;
    overlay = this.menuItemService.displacement;

    @ViewChild('overlayAside', {static: false}) overlayAsideRef?: ElementRef<HTMLElement>;
    @ViewChild('menuCol', {static: false}) menuColRef?: ElementRef<HTMLElement>;

    constructor(private menuItemService: SideMenuService) {
    }

    open(menuItem: SideMenuItem) {
        this.menuItemService.open(menuItem.label);
    }

    close() {
        this.menuItemService.close();
    }

    toggleDisplacement() {
        this.menuItemService.toggleDisplacement();
    }

    togglePin() {
        this.menuItemService.togglePin();
    }
}
