import { Component } from '@angular/core';
import {IconComponent} from "../../icons/icon/icon.component";
import {AppMenuService} from "./app-menu.service";
import {MenuOverlayService} from "../../common/menu-overlay/menu-overlay.service";
import {ContextMenuItem} from "../../common/menu-overlay/menu-overlay.types";

@Component({
  selector: 'app-menu-button',
    imports: [
        IconComponent
    ],
  template: `
      <button class="tab-list-btn" (click)="openMenu($event)"><app-icon name="mdiChevronDown"></app-icon></button>
  `,
  styles: [`
      :host {margin-right: 1rem;}
  `]
})
export class AppMenuButtonComponent {

    constructor(private appMenuService: AppMenuService, private  menu: MenuOverlayService) {
    }

    openMenu(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        const items: ContextMenuItem[] = this.appMenuService.buildMenu();
        this.menu.openContextForElement(event.currentTarget as HTMLElement, { items });

    }
}
