import {Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {GridListComponent} from "./grid-list/grid-list.component";
import {DB} from "./_tauri/db";
import {Environment} from "./common/environment/environment";

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

        `
    ],
    standalone: true
})
export class AppComponent {

    os = OS.platform();

    async initAsync(): Promise<void> {
        //await DB.create(`sqlite:${Environment.dbFilePath()}`);
        await DB.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    );
  `);
        await DB.execute("INSERT into todos (title) VALUES ($1)",
          ["Das hab ich geschafft"]);
        const todos = await DB.query<{ id: number; title: string }>('SELECT * FROM todos');
        console.log(todos);
    }
}
