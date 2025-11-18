import {DestroyRef, Injectable} from '@angular/core';
import {ConfigService} from "../config/+state/config.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Color} from "../common/color/color";
import {Fs} from "../_tauri/fs";
import {Logger} from "../_tauri/logger";
import {ConfigTypes} from "../config/+models/config.types";

@Injectable({
  providedIn: 'root'
})
export class StyleService {

  constructor(configService: ConfigService, destroyRef: DestroyRef) {
      Logger.info('StyleService constructor');
      configService.config$
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(config => this.setStyle(config));
  }

    private setStyle(config: ConfigTypes): void {
        Logger.info('Set Css-Variables...');
        const isLightTheme = Color.isLight(`#${config.color!.background!}`);
        const backgroundFactor = this.getBackgroundFactor(config, isLightTheme);
        const shadowFactor = this.getShadowFactor(isLightTheme);
        const factor = isLightTheme ? -1 : 1;

        document.documentElement.style.setProperty('--background-color', `#${config.color!.background}`);
        document.documentElement.style.setProperty('--background-color-10l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-overlay', `${Color.lightenDarkenColor(`#${config.color!.background!}${Color.getHexOpacity(config.menu?.opacity)}`, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-20l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-30l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-40l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 40)}`);
        document.documentElement.style.setProperty('--background-color-10d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -10)}`);
        document.documentElement.style.setProperty('--background-color-20d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -20)}`);
        document.documentElement.style.setProperty('--background-color-30d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -30)}`);
        document.documentElement.style.setProperty('--background-color-40d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -40)}`);
        document.documentElement.style.setProperty('--color-shadow1', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -10)}`);
        document.documentElement.style.setProperty('--color-shadow2', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -20)}`);
        document.documentElement.style.setProperty('--color-shadow3', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color', `#${config.color!.foreground}`);
        document.documentElement.style.setProperty('--foreground-color-10l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 10)}`);
        document.documentElement.style.setProperty('--foreground-color-20l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 20)}`);
        document.documentElement.style.setProperty('--foreground-color-30l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 30)}`);
        document.documentElement.style.setProperty('--foreground-color-40l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 40)}`);
        document.documentElement.style.setProperty('--foreground-color-10d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -10)}`);
        document.documentElement.style.setProperty('--foreground-color-20d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -20)}`);
        document.documentElement.style.setProperty('--foreground-color-30d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color-40d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -40)}`);
        document.documentElement.style.setProperty('--highlight-color', `#${config.color!.highlight}`);
        document.documentElement.style.setProperty('--highlight-color-10l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 10)}`);
        document.documentElement.style.setProperty('--highlight-color-20l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 20)}`);
        document.documentElement.style.setProperty('--highlight-color-30l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 30)}`);
        document.documentElement.style.setProperty('--highlight-color-40l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 40)}`);
        document.documentElement.style.setProperty('--highlight-color-10d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -10)}`);
        document.documentElement.style.setProperty('--highlight-color-20d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -20)}`);
        document.documentElement.style.setProperty('--highlight-color-30d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -30)}`);
        document.documentElement.style.setProperty('--highlight-color-40d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -40)}`);
        document.documentElement.style.setProperty('--color-green', `#${config.color!.green}`);
        document.documentElement.style.setProperty('--color-red', `#${config.color!.red}`);
        document.documentElement.style.setProperty('--color-blue', `#${config.color!.blue}`);
        document.documentElement.style.setProperty('--color-yellow', `#${config.color!.yellow}`);
        document.documentElement.style.setProperty('--color-white', `#${config.color!.white}`);
        document.documentElement.style.setProperty('--color-black', `#${config.color!.black}`);
        document.documentElement.style.setProperty('--cursor-color', `#${config.cursor!.color}`);
        document.documentElement.style.setProperty('--shadow1', '0 1px 1px 0 var(--color-shadow3), 0 2px 1px -1px var(--color-shadow1), 0 1px 3px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow2', '0 2px 2px 0 var(--color-shadow3), 0 3px 1px -2px var(--color-shadow1), 0 1px 5px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow3', '0 3px 4px 0 var(--color-shadow3), 0 3px 3px -2px var(--color-shadow1), 0 1px 8px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--font-size', `${config.font!.size}px`);
        document.documentElement.style.setProperty('--font-weight', `${config.font!.weight}`);
        document.documentElement.style.setProperty('--font-family', `'${config.font!.family}'`);
        document.documentElement.style.setProperty('--app-font-family', `'${config.font!.app!.family}'`);
        document.documentElement.style.setProperty('--app-font-size', `${config.font!.app!.size}px`);
        document.documentElement.style.setProperty('--padding-xterm', `${config.padding!.top}rem ${config.padding!.right}rem ${config.padding!.bottom}rem ${config.padding!.left}rem`);
        if (config.background_image?.path) {
            const url = Fs.convertFileSrc(config.background_image.path);
            const color = `#${config.color!.background}` + Color.getHexOpacity(config.background_image.opacity);

            // getrennte Variablen, keine Shorthand-„fixed“-Tokens in der CSS-Variable
            document.body.style.setProperty("--background-image", `url("${url}")`);
            document.body.style.setProperty("--background-gradient", `linear-gradient(to bottom, ${color}, ${color})`);
            document.body.style.setProperty("--background-blur", `${config.background_image.blur}px`);

            // Schalter setzen -> aktiviert das ::before
            document.body.classList.add("has-background");
        } else {
            // zurück auf Standard
            document.body.classList.remove("has-background");
            document.body.style.removeProperty("--background-image");
            document.body.style.removeProperty("--background-gradient");
            document.body.style.removeProperty("--background-blur");
            // falls du eine reine Farbfläche willst:
            document.body.style.setProperty("--background-color", `#${config.color!.background!}`);
        }
    }

    private getShadowFactor(isLightTheme: boolean): number {
        if (isLightTheme) {
            return 1;
        }
        return 0.5;
    }

    private getBackgroundFactor(config: ConfigTypes, isLightTheme: boolean) {
        const brightness = Color.getBrightness(`#${config.color!.background!}`);
        const factor = 1.8 - brightness;
        return isLightTheme ? -factor : factor;
    }
}
