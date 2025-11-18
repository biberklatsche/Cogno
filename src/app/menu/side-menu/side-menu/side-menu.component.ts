import {Component, Signal} from '@angular/core';
import {IconComponent} from "../../../icons/icon/icon.component";
import {SideMenuItem, SideMenuService} from "../+state/side-menu.service";

@Component({
  selector: 'app-side-menu',
    imports: [
        IconComponent
    ],
  template: `
          <aside></aside>
          <menu>
          @for (menuItem of menuItems(); track menuItem) {
              <button class="btn-flat" (click)="fire(menuItem?.action)">
                  <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
              </button>
              <button class="btn-flat">
                  <app-icon [name]="menuItem.icon || 'mdiAbTesting'"></app-icon>
              </button>
          }
          </menu>`,
  styles: [`
      :host {
          display: flex;
          flex-direction: row;
      }
      menu {
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0;
      }
      aside {
          height: 100%;
          width: max(33vw, 300px);
          background-color: red;
      }
      button {
          border: none;
          background-color: #00000000;
          color: var(--foreground-color);
          outline: none;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          position: relative;
          opacity: 0.5;
          app-icon {
              color: var(--foreground-color-20d);
              height: calc(var(--header-height) / 2);
          }
          &:hover {
              opacity: 1;
          }
      }
      
  `]
})
export class SideMenuComponent {
    menuItems: Signal<SideMenuItem[]>;

    constructor(menuItemService: SideMenuService) {
        this.menuItems = menuItemService.menu;
    }

    fire(action?: () => void) {
        if(!action) return;
        action();
    }
}
