import {Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from "./terminal/terminal.component";
import {Environment} from "./environment/environment";
import {Logger} from "./_tauri/logger";
import {SettingsFileService} from "./settings/settings-file.service";
import {invoke} from '@tauri-apps/api/core';

type FontInfo = { name: string; is_monospace: boolean };

@Component({
    selector: 'app-root',
    imports: [CommonModule, TerminalComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: true,
})
export class AppComponent {
    constructor(private settingsFileService: SettingsFileService) {
        this.initAsync();
    }

    initAsync(): Promise<void> {
        return this.settingsFileService.loadAndWatch();
    }
}
