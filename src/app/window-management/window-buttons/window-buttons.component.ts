import {Component} from '@angular/core';
import {WindowButtonsService} from './+state/window-buttons.service';
import {CommonModule} from '@angular/common';
import {IconComponent} from "../../icons/icon/icon.component";
import {Environment} from "../../common/environment/environment";

@Component({
    selector: 'app-window-buttons',
    templateUrl: './window-buttons.component.html',
    styleUrls: ['./window-buttons.component.scss'],
    imports: [
        CommonModule,
        IconComponent
    ],
    providers: [WindowButtonsService],
    standalone: true
})
export class WindowButtonsComponent {

  public os = Environment.platform();

  constructor(public readonly service: WindowButtonsService) { }

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
