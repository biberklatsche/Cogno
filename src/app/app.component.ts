import {Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from "./terminal/terminal.component";
import {Environment} from "./environment/environment";
import {Logger} from "./_tauri/logger";

@Component({
    selector: 'app-root',
    imports: [CommonModule, TerminalComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: true,
})
export class AppComponent {
    constructor() {
        Environment.init().then().catch(e => Logger.error('Could not init App.' + e.message));
    }
}
