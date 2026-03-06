import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {AppButtonsService} from './+state/app-buttons.service';

import {OS, OsType} from "../_tauri/os";

@Component({
    selector: 'app-window-buttons',
    template: `
        @if (operatingSystem === 'windows' || operatingSystem === 'linux') {
            <div id="window-buttons" class="{{operatingSystem}}">
                <button class="btn-flat" (click)="minimizeWindow()">
                    <svg class="window-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path [attr.d]="windowControlIconPaths.windowMinimize" fill="currentColor" />
                    </svg>
                </button>
                <button class="btn-flat" (click)="toggleMaximizeWindow()">
                    @if (appButtonsService.isMaximized()) {
                        <svg class="window-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path [attr.d]="operatingSystem === 'linux' ? windowControlIconPaths.linuxArrowCollapse : windowControlIconPaths.windowRestore" fill="currentColor" />
                        </svg>
                    } @else {
                        <svg class="window-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path [attr.d]="operatingSystem === 'linux' ? windowControlIconPaths.linuxArrowExpand : windowControlIconPaths.windowMaximize" fill="currentColor" />
                        </svg>
                    }
                </button>
                <button class="btn-flat close" (click)="closeWindow()">
                    <svg class="window-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path [attr.d]="windowControlIconPaths.close" fill="currentColor" />
                    </svg>
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
                opacity: 0.5;

                .window-control-icon {
                    color: var(--foreground-color-20d);
                    height: calc(var(--header-height) / 2);
                    width: calc(var(--header-height) / 2);
                    display: block;
                }

                &:hover {
                    opacity: 1;
                    background-color: var(--background-color-40l) !important;
                }

                &.close:hover {
                    background-color: var(--highlight-color) !important;
                    .window-control-icon {
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
  protected readonly appButtonsService = inject(AppButtonsService);
  protected readonly windowControlIconPaths = {
    close: 'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z',
    linuxArrowCollapse: 'M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z',
    linuxArrowExpand: 'M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z',
    windowMaximize: 'M4,4H20V20H4V4M6,8V18H18V8H6Z',
    windowMinimize: 'M20,14H4V10H20',
    windowRestore: 'M4,8H8V4H20V16H16V20H4V8M16,8V14H18V6H10V8H16M6,12V18H14V12H6Z'
  } as const;

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

}
