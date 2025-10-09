import {Component} from '@angular/core';
import {WindowService} from '../+state/window.service';
import {CommonModule} from '@angular/common';
import {IconComponent} from "../../icons/icon/icon.component";
import {OS} from "../../_tauri/os";

@Component({
    selector: 'app-window-buttons',
    templateUrl: './window-buttons.component.html',
    styleUrls: ['./window-buttons.component.scss'],
    imports: [
        CommonModule,
        IconComponent
    ],
    standalone: true
})
export class WindowButtonsComponent {

  public os = OS.platform();

  constructor(public readonly service: WindowService) { }

  close() {
    this.service.closeWindow();
  }

  minimize() {
    this.service.minimizeWindow();
  }

  toggleMaximize() {
      if(this.service.isMaximized()) {
          this.service.unmaximizeWindow();
      } else {
          this.service.maximizeWindow();
      }
  }

}
