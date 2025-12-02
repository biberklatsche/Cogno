import {ChangeDetectionStrategy, Component, computed, ElementRef, Signal, ViewChild, effect, OnDestroy} from '@angular/core';
import {IconComponent} from "../../../icons/icon/icon.component";
import {SideMenuItem, SideMenuItemComponent, SideMenuService} from "../+state/side-menu.service";
import {NgComponentOutlet} from "@angular/common";
import {KeybindService} from "../../../keybinding/keybind.service";

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
            <main>
                @if (selectedItem()?.component) {
                    <ng-container *ngComponentOutlet="selectedItem()!.component"
                                  (ngComponentOutletActivate)="onActivate($event)"
                                  (ngComponentOutletDeactivate)="onDeactivate()"></ng-container>
                }
            </main>
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
            
            main {
                padding: 0.5rem;
            }
        }
    `]
})
export class SideMenuComponent implements OnDestroy {
    menuItems: Signal<SideMenuItem[]> = this.menuItemService.menu;
    visibleItems: Signal<SideMenuItem[]> = computed(() => this.menuItems().filter(i => !i.hidden));
    selectedItem = this.menuItemService.selectedItem;
    displacement = this.menuItemService.displacement;

    @ViewChild('overlayAside', {static: false}) overlayAsideRef?: ElementRef<HTMLElement>;
    @ViewChild('menuCol', {static: false}) menuColRef?: ElementRef<HTMLElement>;

    private activeComponentInstance?: SideMenuItemComponent;
    private readonly listenerId = 'SideMenuComponentListener';

    constructor(private menuItemService: SideMenuService, private keybindService: KeybindService) {
        effect(() => {
            const active = this.selectedItem();
            if (!active) {
                this.keybindService.unregisterListener(this.listenerId);
                return;
            }
            const keys = (active.keys && active.keys.length > 0) ? active.keys : ['Escape'];
            this.keybindService.registerListener(this.listenerId, keys, (event: KeyboardEvent) => this.handleKey(event));
        });
    }

    ngOnDestroy(): void {
        this.keybindService.unregisterListener(this.listenerId);
    }

    private handleKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.menuItemService.close();
        }
        // forward to hosted component if it exposes an optional handler
        const inst = this.activeComponentInstance as SideMenuItemComponent | undefined;
        try { inst?.onSideMenuKey(event); } catch {}
    }

    onActivate(instance: unknown) {
        // The component is typed via SideMenuItem.component: Type<SideMenuItemComponent>
        // Cast to the required handler interface.
        this.activeComponentInstance = instance as SideMenuItemComponent;
    }

    onDeactivate() {
        this.activeComponentInstance = undefined;
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
