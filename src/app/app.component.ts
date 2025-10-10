import {Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from './terminal/terminal.component';
import {WindowButtonsComponent} from "./window/window-buttons/window-buttons.component";
import {TabListComponent} from "./tab/tab-list/tab-list.component";
import {OS} from "./_tauri/os";
import {AppBus} from "./event-bus/event-bus";
import {Environment} from "./common/environment/environment";
import {StyleService} from "./common/style/style.service";

window.addEventListener("keydown", (e) => {
    console.log(e.key);
   if(e.key == 'e'){
       e.preventDefault();
       e.stopPropagation();
   }
}, { capture: true });


@Component({
    selector: 'app-root',
    imports: [CommonModule, TerminalComponent, WindowButtonsComponent, TabListComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: true
})
export class AppComponent {

    os = OS.platform();

    constructor(bus: AppBus) {
        bus.send({type: "LoadConfigCommand"});
        bus.send({type: "WatchConfigCommand"});
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
