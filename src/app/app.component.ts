import {Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {GridListComponent} from "./grid-list/grid-list.component";
import {CommandPaletteComponent} from "./command-palette/command-palette.component";
import {CommandPaletteService} from "./command-palette/command-palette.service";

@Component({
    selector: 'app-root',
    imports: [CommonModule, GridListComponent, AppButtonsComponent, TabListComponent, CommandPaletteComponent],
    template: `
    <header [class.space-left-window-buttons]="os === 'macos'">
        <app-tab-list></app-tab-list>
        <app-window-buttons></app-window-buttons>
    </header>
    <main>
        <app-grid-list></app-grid-list>
    </main>

    <!-- Command Palette Overlay -->
    @if (cp.visible()) {
      <div class="cp-overlay" (click)="cp.close()">
        <div class="cp-shell" (click)="$event.stopPropagation()">
          <app-command-palette (onClose)="cp.close()"></app-command-palette>
        </div>
      </div>
    }
    `,
    styles: [
        `
            :host {
                display: flex;
                flex-direction: column;
                --header-height: 34px;
                overflow: hidden;
                height: 100vh;
                width: 100vw;
            }

            header {
                height: var(--header-height);
                display: flex;
                flex-direction: row;
                /* Keep items in a single row and let flex growth handle spacing */
                justify-content: flex-start;
                align-items: center;
                overflow: hidden;
                max-width: 100vw;
                &.space-left-window-buttons {
                    padding-left: 65px;
                }
            }

            main {
                width: 100vw;
                height: calc(100vh - var(--header-height));
                display: flex;
                flex-direction: column;
            }

            /* Command Palette Overlay styles */
            .cp-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.2);
                z-index: 1000;
                pointer-events: auto;
            }
            .cp-shell {
                position: absolute;
                left: 50%;
                top: 20%; /* upper third-ish */
                transform: translateX(-50%);
                width: min(720px, 90vw);
                padding: 12px;
                border-radius: 10px;
                backdrop-filter: blur(8px);
                background: rgba(20,20,20,0.85);
                box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            }

        `
    ],
    standalone: true
})
export class AppComponent {


    os = OS.platform();

    constructor(public cp: CommandPaletteService) {}

    async initAsync(): Promise<void> {}
}
