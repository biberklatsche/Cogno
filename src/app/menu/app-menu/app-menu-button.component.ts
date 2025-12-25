import { Component } from '@angular/core';
import {IconComponent} from "../../icons/icon/icon.component";
import {AppMenuService} from "./app-menu.service";
import {ContextMenuOverlayService} from "../context-menu-overlay/context-menu-overlay.service";
import {ContextMenuItem} from "../context-menu-overlay/context-menu-overlay.types";

@Component({
  selector: 'app-menu-button',
    imports: [
        IconComponent
    ],
  template: `
      <button class="button-borderless" (click)="openMenu($event)"><app-icon name="mdiChevronDown"></app-icon></button>
  `,
  styles: [`
      :host {margin-right: 1rem;}
  `]
})
export class AppMenuButtonComponent {

    constructor(private appMenuService: AppMenuService, private  menu: ContextMenuOverlayService) {
    }

    openMenu(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        const items: ContextMenuItem[] = this.appMenuService.buildMenu();
        this.menu.openContextForElement(event.currentTarget as HTMLElement, { items });

    }
}
