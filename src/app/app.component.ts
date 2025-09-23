import {Component, OnDestroy, signal, ViewEncapsulation} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from './terminal/terminal.component';
import {Environment} from './common/environment/environment';
import {SettingsService} from "./settings/+state/settings.service";
import {Theme} from './settings/+models/settings';
import { Color } from './common/color/color';
import { SafeStyle } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import {Database} from './_tauri/db';
import {WindowButtonsComponent} from "./window-management/window-buttons/window-buttons.component";

@Component({
    selector: 'app-root',
    imports: [CommonModule, TerminalComponent, WindowButtonsComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: true
})
export class AppComponent implements OnDestroy {

    style: SafeStyle | undefined;
    imageFilter= signal<string | undefined>(undefined);
    subscriptions: Subscription[] = [];

    constructor(private settingsService: SettingsService) {
        this.initAsync().then();

        this.subscriptions.push(this.settingsService.activeTheme$.subscribe(theme => this.setStyle(theme)));
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    async initAsync(): Promise<void> {
        await Environment.init();
        await this.settingsService.loadAndWatch();
        const db = await Database.create(`sqlite:${Environment.dbFilePath()}`);
        await db.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL
    );
  `);
        await db.execute("INSERT into todos (title) VALUES ($1)",
          ["Das hab ich geschafft"]);
        const todos = await db.query<{ id: number; title: string }>('SELECT * FROM todos');
        console.log(todos);
    }

    private setStyle(theme: Theme): void {
        const isLightTheme = Color.isLight(theme.colors.background);
        const backgroundFactor = this.getBackgroundFactor(theme, isLightTheme);
        const shadowFactor = this.getShadowFactor(isLightTheme);
        const factor = isLightTheme ? -1 : 1;
        if (theme.image) {
            this.imageFilter.set(`blur(${theme.imageBlur === undefined ? 10 : theme.imageBlur}px)`);
        } else {
            this.imageFilter.set('');
        }

        document.documentElement.style.setProperty('--background-color', `${theme.colors.background}`);
        document.documentElement.style.setProperty('--background-color-10l', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-20l', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-30l', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-40l', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * 40)}`);
        document.documentElement.style.setProperty('--background-color-10d', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * -10)}`);
        document.documentElement.style.setProperty('--background-color-20d', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * -20)}`);
        document.documentElement.style.setProperty('--background-color-30d', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * -30)}`);
        document.documentElement.style.setProperty('--background-color-40d', `${Color.lightenDarkenColor(theme.colors.background, backgroundFactor * -40)}`);
        document.documentElement.style.setProperty('--color-shadow1', `${Color.lightenDarkenColor(theme.colors.background, shadowFactor * -10)}`);
        document.documentElement.style.setProperty('--color-shadow2', `${Color.lightenDarkenColor(theme.colors.background, shadowFactor * -20)}`);
        document.documentElement.style.setProperty('--color-shadow3', `${Color.lightenDarkenColor(theme.colors.background, shadowFactor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color', `${theme.colors.foreground}`);
        document.documentElement.style.setProperty('--foreground-color-10l', `${Color.lightenDarkenColor(theme.colors.foreground, factor * 10)}`);
        document.documentElement.style.setProperty('--foreground-color-20l', `${Color.lightenDarkenColor(theme.colors.foreground, factor * 20)}`);
        document.documentElement.style.setProperty('--foreground-color-30l', `${Color.lightenDarkenColor(theme.colors.foreground, factor * 30)}`);
        document.documentElement.style.setProperty('--foreground-color-40l', `${Color.lightenDarkenColor(theme.colors.foreground, factor * 40)}`);
        document.documentElement.style.setProperty('--foreground-color-10d', `${Color.lightenDarkenColor(theme.colors.foreground, factor * -10)}`);
        document.documentElement.style.setProperty('--foreground-color-20d', `${Color.lightenDarkenColor(theme.colors.foreground, factor * -20)}`);
        document.documentElement.style.setProperty('--foreground-color-30d', `${Color.lightenDarkenColor(theme.colors.foreground, factor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color-40d', `${Color.lightenDarkenColor(theme.colors.foreground, factor * -40)}`);
        document.documentElement.style.setProperty('--highlight-color', `${theme.colors.highlight}`);
        document.documentElement.style.setProperty('--highlight-color-10l', `${Color.lightenDarkenColor(theme.colors.highlight, factor * 10)}`);
        document.documentElement.style.setProperty('--highlight-color-20l', `${Color.lightenDarkenColor(theme.colors.highlight, factor * 20)}`);
        document.documentElement.style.setProperty('--highlight-color-30l', `${Color.lightenDarkenColor(theme.colors.highlight, factor * 30)}`);
        document.documentElement.style.setProperty('--highlight-color-40l', `${Color.lightenDarkenColor(theme.colors.highlight, factor * 40)}`);
        document.documentElement.style.setProperty('--highlight-color-10d', `${Color.lightenDarkenColor(theme.colors.highlight, factor * -10)}`);
        document.documentElement.style.setProperty('--highlight-color-20d', `${Color.lightenDarkenColor(theme.colors.highlight, factor * -20)}`);
        document.documentElement.style.setProperty('--highlight-color-30d', `${Color.lightenDarkenColor(theme.colors.highlight, factor * -30)}`);
        document.documentElement.style.setProperty('--highlight-color-40d', `${Color.lightenDarkenColor(theme.colors.highlight, factor * -40)}`);
        document.documentElement.style.setProperty('--color-green', `${theme.colors.green}`);
        document.documentElement.style.setProperty('--color-red', `${theme.colors.red}`);
        document.documentElement.style.setProperty('--color-blue', `${theme.colors.blue}`);
        document.documentElement.style.setProperty('--color-yellow', `${theme.colors.yellow}`);
        document.documentElement.style.setProperty('--color-white', `${theme.colors.white}`);
        document.documentElement.style.setProperty('--color-black', `${theme.colors.black}`);
        document.documentElement.style.setProperty('--cursor-color', `${theme.colors.cursor}`);
        document.documentElement.style.setProperty('--shadow1', '0 1px 1px 0 var(--color-shadow3), 0 2px 1px -1px var(--color-shadow1), 0 1px 3px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow2', '0 2px 2px 0 var(--color-shadow3), 0 3px 1px -2px var(--color-shadow1), 0 1px 5px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow3', '0 3px 4px 0 var(--color-shadow3), 0 3px 3px -2px var(--color-shadow1), 0 1px 8px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--appFontSize', `${theme.appFontsize}px`);
        document.documentElement.style.setProperty('--fontSize', `${theme.fontsize}px`);
        document.documentElement.style.setProperty('--fontWeight', `${theme.fontWeight}`);
        document.documentElement.style.setProperty('--fontFamily', `'${theme.fontFamily}'`);
        document.documentElement.style.setProperty('--appFontFamily', `'${theme.appFontFamily}'`);
        // document.documentElement.style.setProperty('--padding', `${theme.paddingAsArray[3]}rem`);
        // document.documentElement.style.setProperty('--padding-xterm', `${theme.paddingAsArray[0]}rem ${theme.paddingAsArray[1]}rem ${theme.paddingAsArray[2]}rem ${theme.paddingAsArray[3]}rem`);
        document.documentElement.style.setProperty('--color-command-running', `${theme.colors.commandRunning}`);
        document.documentElement.style.setProperty('--color-command-success', `${theme.colors.commandSuccess}`);
        document.documentElement.style.setProperty('--color-command-error', `${theme.colors.commandError}`);
        if (theme.image) {
            const imageUrl = `url(file:///${theme.image.trim()})`;
            const color = theme.colors.background + Color.getHexOpacity(theme.imageOpacity ?? 75);
            document.body.style.background = `linear-gradient(to bottom, ${color}, ${color}), ${imageUrl} no-repeat center center fixed`;
            document.body.style.backgroundSize = 'cover';
        }
    }

    private getShadowFactor(isLightTheme: boolean): number {
        if (isLightTheme) {
            return 1;
        }
        return 0.5;
    }


    private getBackgroundFactor(theme: Theme, isLightTheme: boolean) {
        const brightness = Color.getBrightness(theme.colors.background);
        const factor = 1.8 - brightness;
        return isLightTheme ? -factor : factor;
    }
}
