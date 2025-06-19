import {Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from "./terminal/terminal.component";
import {Environment} from "./environment/environment";
import {Logger} from "./_tauri/logger";
import {SettingsService} from "./settings/settings.service";
import {invoke} from '@tauri-apps/api/core';

@Component({
    selector: 'app-root',
    imports: [CommonModule, TerminalComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: true,
})
export class AppComponent {

    constructor(private settingsService: SettingsService) {
        this.initAsync().then();
    }

    async initAsync(): Promise<void> {
        await Environment.init();
        await this.settingsService.loadAndWatch();
    }
}
