import {Component, OnDestroy, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {GridListComponent} from "./grid-list/grid-list.component";

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
export class AppComponent implements OnInit, OnDestroy {

    os = OS.platform();

    private scrollingTimeoutId: any = null;
    private onWheelHandler = () => this.handleUserScroll();

    ngOnInit(): void {
        const config: string = 'auto';
        if(config === 'never') {
            return;
        }
        if(config === 'always') {
            const body = document.body;
            if (!body.classList.contains('scrolling')) {
                body.classList.add('scrolling');
            }
        } else {
            window.addEventListener('wheel', this.onWheelHandler, { passive: true } as any);
        }


    }

    ngOnDestroy(): void {
        window.removeEventListener('wheel', this.onWheelHandler as any, true as any);
        if (this.scrollingTimeoutId) {
            clearTimeout(this.scrollingTimeoutId);
            this.scrollingTimeoutId = null;
        }
    }

    private handleUserScroll(): void {
        const body = document.body;

        if (!body.classList.contains('scrolling')) {
            body.classList.add('scrolling');
        }

            if (this.scrollingTimeoutId) {
                clearTimeout(this.scrollingTimeoutId);
            }
            this.scrollingTimeoutId = setTimeout(() => {
                body.classList.remove('scrolling');
                this.scrollingTimeoutId = null;
            }, 600);
    }

    async initAsync(): Promise<void> {
        /*const db = await Database.create(`sqlite:${Environment.dbFilePath()}`);
        await db.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    );
  `);
        await db.execute("INSERT into todos (title) VALUES ($1)",
          ["Das hab ich geschafft"]);
        const todos = await db.query<{ id: number; title: string }>('SELECT * FROM todos');
        console.log(todos);*/
    }
}
