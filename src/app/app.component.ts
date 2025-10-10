import {Component, OnDestroy} from '@angular/core';
import { CommonModule } from '@angular/common';
import {TerminalComponent} from './terminal/terminal.component';
import {Environment} from './common/environment/environment';
import {ConfigService} from "./config/+state/config.service";
import {Theme} from './config/+models/config';
import { Color } from './common/color/color';
import { Subscription } from 'rxjs';
import {WindowButtonsComponent} from "./window/window-buttons/window-buttons.component";
import {Fs} from "./_tauri/fs";
import {TabListComponent} from "./tab/tab-list/tab-list.component";
import {OS} from "./_tauri/os";

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
export class AppComponent implements OnDestroy {

    public os = OS.platform();
    private subscriptions: Subscription[] = [];

    constructor(private configService: ConfigService) {
        this.initAsync().then();
        this.subscriptions.push(this.configService.activeTheme$.subscribe(theme => this.setStyle(theme)));
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    async initAsync(): Promise<void> {
        await Environment.init();
        await this.configService.loadAndWatch();
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

    private setStyle(theme: Theme): void {
        const isLightTheme = Color.isLight(theme.color.background);
        const backgroundFactor = this.getBackgroundFactor(theme, isLightTheme);
        const shadowFactor = this.getShadowFactor(isLightTheme);
        const factor = isLightTheme ? -1 : 1;

        document.documentElement.style.setProperty('--background-color', `${theme.color.background}`);
        document.documentElement.style.setProperty('--background-color-10l', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-20l', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-30l', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-40l', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * 40)}`);
        document.documentElement.style.setProperty('--background-color-10d', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * -10)}`);
        document.documentElement.style.setProperty('--background-color-20d', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * -20)}`);
        document.documentElement.style.setProperty('--background-color-30d', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * -30)}`);
        document.documentElement.style.setProperty('--background-color-40d', `${Color.lightenDarkenColor(theme.color.background, backgroundFactor * -40)}`);
        document.documentElement.style.setProperty('--color-shadow1', `${Color.lightenDarkenColor(theme.color.background, shadowFactor * -10)}`);
        document.documentElement.style.setProperty('--color-shadow2', `${Color.lightenDarkenColor(theme.color.background, shadowFactor * -20)}`);
        document.documentElement.style.setProperty('--color-shadow3', `${Color.lightenDarkenColor(theme.color.background, shadowFactor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color', `${theme.color.foreground}`);
        document.documentElement.style.setProperty('--foreground-color-10l', `${Color.lightenDarkenColor(theme.color.foreground, factor * 10)}`);
        document.documentElement.style.setProperty('--foreground-color-20l', `${Color.lightenDarkenColor(theme.color.foreground, factor * 20)}`);
        document.documentElement.style.setProperty('--foreground-color-30l', `${Color.lightenDarkenColor(theme.color.foreground, factor * 30)}`);
        document.documentElement.style.setProperty('--foreground-color-40l', `${Color.lightenDarkenColor(theme.color.foreground, factor * 40)}`);
        document.documentElement.style.setProperty('--foreground-color-10d', `${Color.lightenDarkenColor(theme.color.foreground, factor * -10)}`);
        document.documentElement.style.setProperty('--foreground-color-20d', `${Color.lightenDarkenColor(theme.color.foreground, factor * -20)}`);
        document.documentElement.style.setProperty('--foreground-color-30d', `${Color.lightenDarkenColor(theme.color.foreground, factor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color-40d', `${Color.lightenDarkenColor(theme.color.foreground, factor * -40)}`);
        document.documentElement.style.setProperty('--highlight-color', `${theme.color.highlight}`);
        document.documentElement.style.setProperty('--highlight-color-10l', `${Color.lightenDarkenColor(theme.color.highlight, factor * 10)}`);
        document.documentElement.style.setProperty('--highlight-color-20l', `${Color.lightenDarkenColor(theme.color.highlight, factor * 20)}`);
        document.documentElement.style.setProperty('--highlight-color-30l', `${Color.lightenDarkenColor(theme.color.highlight, factor * 30)}`);
        document.documentElement.style.setProperty('--highlight-color-40l', `${Color.lightenDarkenColor(theme.color.highlight, factor * 40)}`);
        document.documentElement.style.setProperty('--highlight-color-10d', `${Color.lightenDarkenColor(theme.color.highlight, factor * -10)}`);
        document.documentElement.style.setProperty('--highlight-color-20d', `${Color.lightenDarkenColor(theme.color.highlight, factor * -20)}`);
        document.documentElement.style.setProperty('--highlight-color-30d', `${Color.lightenDarkenColor(theme.color.highlight, factor * -30)}`);
        document.documentElement.style.setProperty('--highlight-color-40d', `${Color.lightenDarkenColor(theme.color.highlight, factor * -40)}`);
        document.documentElement.style.setProperty('--color-green', `${theme.color.green}`);
        document.documentElement.style.setProperty('--color-red', `${theme.color.red}`);
        document.documentElement.style.setProperty('--color-blue', `${theme.color.blue}`);
        document.documentElement.style.setProperty('--color-yellow', `${theme.color.yellow}`);
        document.documentElement.style.setProperty('--color-white', `${theme.color.white}`);
        document.documentElement.style.setProperty('--color-black', `${theme.color.black}`);
        document.documentElement.style.setProperty('--cursor-color', `${theme.color.cursor}`);
        document.documentElement.style.setProperty('--shadow1', '0 1px 1px 0 var(--color-shadow3), 0 2px 1px -1px var(--color-shadow1), 0 1px 3px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow2', '0 2px 2px 0 var(--color-shadow3), 0 3px 1px -2px var(--color-shadow1), 0 1px 5px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow3', '0 3px 4px 0 var(--color-shadow3), 0 3px 3px -2px var(--color-shadow1), 0 1px 8px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--appFontSize', `${theme.app_font.size}px`);
        document.documentElement.style.setProperty('--fontSize', `${theme.terminal_font.size}px`);
        document.documentElement.style.setProperty('--fontWeight', `${theme.terminal_font.weight}`);
        document.documentElement.style.setProperty('--fontFamily', `'${theme.terminal_font.family}'`);
        document.documentElement.style.setProperty('--appFontFamily', `'${theme.app_font.family}'`);
        document.documentElement.style.setProperty('--padding-xterm', `${theme.padding.value.trim()
            .split(/\s+/)
            .map(num => `${num}rem`)
            .join(" ")}`);
        document.documentElement.style.setProperty('--color-command-running', `${theme.color.command_running}`);
        document.documentElement.style.setProperty('--color-command-success', `${theme.color.command_success}`);
        document.documentElement.style.setProperty('--color-command-error', `${theme.color.command_error}`);
        if (theme.image) {
            const url = Fs.convertFileSrc(theme.image.path);
            const color = theme.color.background + Color.getHexOpacity(theme.image.opacity);

            // getrennte Variablen, keine Shorthand-„fixed“-Tokens in der CSS-Variable
            document.body.style.setProperty("--background-image", `url("${url}")`);
            document.body.style.setProperty("--background-gradient", `linear-gradient(to bottom, ${color}, ${color})`);
            document.body.style.setProperty("--background-blur", `${theme.image.blur}px`);

            // Schalter setzen -> aktiviert das ::before
            document.body.classList.add("has-background");
        } else {
            // zurück auf Standard
            document.body.classList.remove("has-background");
            document.body.style.removeProperty("--background-image");
            document.body.style.removeProperty("--background-gradient");
            document.body.style.removeProperty("--background-blur");
            // falls du eine reine Farbfläche willst:
            document.body.style.setProperty("--background-color", theme.color.background);
        }
    }

    private getShadowFactor(isLightTheme: boolean): number {
        if (isLightTheme) {
            return 1;
        }
        return 0.5;
    }


    private getBackgroundFactor(theme: Theme, isLightTheme: boolean) {
        const brightness = Color.getBrightness(theme.color.background);
        const factor = 1.8 - brightness;
        return isLightTheme ? -factor : factor;
    }
}
