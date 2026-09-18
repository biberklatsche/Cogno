import { Component, Input } from "@angular/core";
import { ICONS, Icon } from "../../icon";

@Component({
  selector: "app-icon",
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      svg {
        fill: currentColor;
        height: 100%;
      }
    `,
  ],
  template: `
    <svg viewBox="0 0 24 24" style="display:inline-block;">
      <path [attr.d]="icon" d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z" />
    </svg>
  `,
})
export class IconComponent {
  icon: string = ICONS.mdiAbTesting;

  @Input()
  set name(icon: Icon) {
    this.icon = ICONS[icon] ?? ICONS.mdiAbTesting;
  }
}
