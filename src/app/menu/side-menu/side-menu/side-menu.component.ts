import {Component, Signal} from '@angular/core';
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
        '[class.overlay-host]': 'selectedItem()?.overlay === true'
    },
  template: `
          <aside class="base-overlay"
                 [class.hidden]="!selectedItem()"
                 [class.overlay]="selectedItem()?.overlay === true">
              <header>
                  <button class="tab-list-btn" (click)="togglePin()">
                      <app-icon [name]="selectedItem()?.overlay ? 'mdiPinOff' : 'mdiPin'"></app-icon>
                  </button>
                  <h3>{{selectedItem()?.label}}</h3>
              </header>
              @if (selectedItem()?.component) {
                  <ng-container *ngComponentOutlet="selectedItem()!.component"></ng-container>
              }
          </aside>
          <menu>
          @for (menuItem of menuItems(); track menuItem) {
              <button class="tab-list-btn" (click)="toggle(menuItem)" [class.active]="selectedItem() === menuItem">
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

    constructor(private menuItemService: SideMenuService) {
        this.menuItems = this.menuItemService.menu;
    }

    toggle(menuItem: SideMenuItem) {
        this.menuItemService.toggle(menuItem);
    }

    togglePin() {
        this.menuItemService.togglePin();
    }
}
