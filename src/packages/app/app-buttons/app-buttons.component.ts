import {ChangeDetectionStrategy, Component} from '@angular/core';
import {AppButtonsService} from './+state/app-buttons.service';

import {OS, OsType} from "@cogno/app-tauri/os";

type WindowControlIconName =
  | "close"
  | "linux-arrow-collapse"
  | "linux-arrow-expand"
  | "window-maximize"
  | "window-minimize"
  | "window-restore";

@Component({
    selector: 'app-window-buttons',
    template: `
        @if (operatingSystem === 'windows' || operatingSystem === 'linux') {
            <div id="window-buttons" class="{{operatingSystem}}">
                <button class="btn-flat" (click)="minimizeWindow()">
                    <span class="window-control-icon" [style.mask-image]="iconMask('window-minimize')" [style.webkit-mask-image]="iconMask('window-minimize')" aria-hidden="true"></span>
                </button>
                <button class="btn-flat" (click)="toggleMaximizeWindow()">
                    @if (appButtonsService.isMaximized()) {
                        <span
                          class="window-control-icon"
                          [style.mask-image]="iconMask(operatingSystem === 'linux' ? 'linux-arrow-collapse' : 'window-restore')"
                          [style.webkit-mask-image]="iconMask(operatingSystem === 'linux' ? 'linux-arrow-collapse' : 'window-restore')"
                          aria-hidden="true"
                        ></span>
                    } @else {
                        <span
                          class="window-control-icon"
                          [style.mask-image]="iconMask(operatingSystem === 'linux' ? 'linux-arrow-expand' : 'window-maximize')"
                          [style.webkit-mask-image]="iconMask(operatingSystem === 'linux' ? 'linux-arrow-expand' : 'window-maximize')"
                          aria-hidden="true"
                        ></span>
                    }
                </button>
                <button class="btn-flat close" (click)="closeWindow()">
                    <span class="window-control-icon" [style.mask-image]="iconMask('close')" [style.webkit-mask-image]="iconMask('close')" aria-hidden="true"></span>
                </button>
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
                padding: 0;
                position: relative;
                opacity: 1;

                .window-control-icon {
                    background-color: currentColor;
                    height: calc(var(--header-height) / 2);
                    width: calc(var(--header-height) / 2);
                    display: block;
                    mask-repeat: no-repeat;
                    mask-position: center;
                    mask-size: contain;
                    -webkit-mask-repeat: no-repeat;
                    -webkit-mask-position: center;
                    -webkit-mask-size: contain;
                }

                &:hover {
                    background-color: var(--background-color-40l) !important;
                }

                &.close:hover {
                    background-color: var(--highlight-color) !important;
                    color: var(--background-color);
                }
            }

            &.linux {
                button {
                    border-radius: 50%;
                    margin: 5px 0 0 10px;
                    height: 22px;
                    width: 22px;
                    display: grid;
                    place-items: center;

                    &:last-child {
                        margin-right: 5px;
                    }
                }

                .window-control-icon {
                    width: 12px;
                    height: 12px;
                }
            }

            &.windows {
                button {
                    border-radius: 0;
                }
            }
        }
    `],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppButtonsComponent {

  protected readonly operatingSystem: OsType = OS.platform();

  constructor(protected readonly appButtonsService: AppButtonsService) {}

  protected iconMask(iconName: WindowControlIconName): string {
    return `url('assets/icons/window-controls/${iconName}.svg')`;
  }

  protected closeWindow(): void {
    this.appButtonsService.closeWindow();
  }

  protected minimizeWindow(): void {
    this.appButtonsService.minimizeWindow();
  }

  protected toggleMaximizeWindow(): void {
      if (this.appButtonsService.isMaximized()) {
          this.appButtonsService.unmaximizeWindow();
      } else {
          this.appButtonsService.maximizeWindow();
      }
  }

  close(): void {
    this.closeWindow();
  }

  minimize(): void {
    this.minimizeWindow();
  }

  toggleMaximize(): void {
    this.toggleMaximizeWindow();
  }

}


