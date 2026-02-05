import {Component} from '@angular/core';
import {AppButtonsService} from './+state/app-buttons.service';

import {IconComponent} from "../icons/icon/icon.component";
import {OS} from "../_tauri/os";

@Component({
    selector: 'app-window-buttons',
    template: `
        @if (os === 'windows' || os === 'linux') {
            <div id="window-buttons" class="{{os}}">
                <button class="btn-flat" (click)="minimize()">
                    <app-icon name="mdiWindowMinimize"></app-icon>
                </button>
                <button class="btn-flat" (click)="toggleMaximize()">
                    <app-icon [name]="(service.isMaximized()) ? 'mdiWindowRestore' : 'mdiWindowMaximize'"></app-icon>
                </button>
                <button class="btn-flat close" (click)="close()"><app-icon name="mdiClose"></app-icon></button>
            </div>
        }

    `,
    styles: [`
        #window-buttons {
            display: flex;
            height: var(--header-height);
            flex-direction: row;
            justify-content: flex-end;

            button {
                width: calc(var(--header-height) * 1.3);
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
                    background-color: var(--background-color-40l) !important;
                }

                &.close:hover {
                    background-color: var(--highlight-color) !important;
                    app-icon {
                        color: var(--background-color);
                    }
                }
            }

            &.linux {
                button {
                    border-radius: 50%;
                    margin: 5px 0 0 10px;
                    height: 22px;
                    width: 22px;

                    &:last-child {
                        margin-right: 5px;
                    }
                }
            }

            &.windows {
                button {
                    border-radius: 0;
                }
            }
        }
    `],
    imports: [
    IconComponent
],
    standalone: true
})
export class AppButtonsComponent {

  public os = OS.platform();

  constructor(public readonly service: AppButtonsService) { }

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
