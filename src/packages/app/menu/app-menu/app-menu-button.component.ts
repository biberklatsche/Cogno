import { Component } from "@angular/core";
import { ContextMenuItem, ContextMenuOverlayService, IconComponent } from "@cogno/core-ui";
import { AppMenuService } from "./app-menu.service";

@Component({
  selector: "app-menu-button",
  imports: [IconComponent],
  template: `
      <button class="button icon-button" (click)="openMenu($event)"><app-icon name="mdiChevronDown"></app-icon></button>
  `,
  styles: [
    `
      :host {margin-right: 1rem;}
  `,
  ],
})
export class AppMenuButtonComponent {
  constructor(
    private appMenuService: AppMenuService,
    private menu: ContextMenuOverlayService,
  ) {}

  openMenu(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const items: ContextMenuItem[] = this.appMenuService.buildMenu();
    this.menu.openAtElement(event.currentTarget as HTMLElement, { items });
  }
}
