import {Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from './terminal/terminal.component';
import {AppButtonsComponent} from "./app-buttons/app-buttons.component";
import {TabListComponent} from "./tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {AppBus} from "./app-bus/app-bus";
import {GridListComponent} from "./grid-list/grid-list.component";

/*window.addEventListener("keydown", (e) => {
    console.log(e.key);
   if(e.key == 'e'){
       e.preventDefault();
       e.stopPropagation();
   }
}, { capture: true });*/


@Component({
    selector: 'app-root',
    imports: [CommonModule, GridListComponent, AppButtonsComponent, TabListComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: true
})
export class AppComponent {

    os = OS.platform();

    constructor(bus: AppBus) {
        bus.publish({type: "LoadConfigCommand"});
        bus.publish({type: "WatchConfigCommand"});
        bus.once$({path: ['app', 'config'], type: 'ConfigLoaded'})
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
