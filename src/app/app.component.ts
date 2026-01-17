import {Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {GridListComponent} from "./grid-list/grid-list.component";
import {AppBus} from "./app-bus/app-bus";
import {DB} from "./_tauri/db";
import {Environment} from "./common/environment/environment";
import {migrate} from "./migrations/migrate";

@Component({
    selector: 'app-root',
    imports: [CommonModule, GridListComponent, AppButtonsComponent, TabListComponent],
    template: `
    <header [class.space-left-window-buttons]="os === 'macos'">
        <app-tab-list></app-tab-list>
        <app-window-buttons></app-window-buttons>
    </header>
    <main>
        <app-grid-list></app-grid-list>
    </main>
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
        `
    ],
    standalone: true
})
export class AppComponent {
    os = OS.platform();
    constructor(bus: AppBus) {
        bus.onceType$('ConfigLoaded').subscribe(async e => {
            await DB.load(`sqlite:${Environment.dbFilePath()}`);
            await migrate();
            bus.publish({type: 'DBInitialized'});
        });
    }
}
