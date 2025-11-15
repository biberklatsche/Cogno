import {Component, DestroyRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from './terminal/terminal.component';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {AppBus} from "./app-bus/app-bus";
import {GridListComponent} from "./grid-list/grid-list.component";
import {InspectorComponent} from "./inspector/inspector.component";
import {AppMenuButtonComponent} from "./menu/app-menu/app-menu-button.component";
import {take} from "rxjs/operators";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {invoke} from "@tauri-apps/api/core";
import {Pty} from "./terminal/+state/pty/pty";
import {AppWindow} from "./_tauri/window";
import {Logger} from "./_tauri/logger";

@Component({
    selector: 'app-root',
    imports: [CommonModule, GridListComponent, AppButtonsComponent, TabListComponent, InspectorComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: true
})
export class AppComponent {

    os = OS.platform();

    constructor(bus: AppBus, ref: DestroyRef) {

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
