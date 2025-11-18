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
  template: `
          <aside class="base-overlay" [class.hidden]="!selectedItem()">
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
      }
      aside {
          width: max(33vw, 300px);
          margin-bottom: 4px;
      }
      aside.hidden {
          display: none;
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
}
