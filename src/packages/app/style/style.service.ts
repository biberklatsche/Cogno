import {DestroyRef, Injectable} from '@angular/core';
import {ConfigService} from "../config/+state/config.service";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {Color} from "../common/color/color";
import {Fs} from "@cogno/app-tauri/fs";
import {Logger} from "@cogno/app-tauri/logger";
import {Config} from "../config/+models/config";
import {Path} from "@cogno/app-tauri/path";

@Injectable({
  providedIn: 'root'
})
export class StyleService {

  constructor(configService: ConfigService, destroyRef: DestroyRef) {
      Logger.info('StyleService constructor');
      configService.config$
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(config => void this.setStyle(config));
  }

    private async setStyle(config: Config): Promise<void> {
        Logger.info('Set Css-Variables...');
        const isLightTheme = Color.isLight(`#${config.color!.background!}`);
        const backgroundFactor = this.getBackgroundFactor(config, isLightTheme);
        const shadowFactor = this.getShadowFactor(isLightTheme);
        const factor = isLightTheme ? -1 : 1;
        const menuOpacity = config.menu?.opacity ?? 100;
        const opacity = Color.getHexOpacity(menuOpacity)
        const opacityDouble = Color.getHexOpacity(menuOpacity === 100 ? 100 : menuOpacity / 2);
        const inactiveOpacity = (config.terminal?.inactive_overlay_opacity ?? 50) / 100;

        document.documentElement.style.setProperty('--background-color', `#${config.color!.background}`);
        document.documentElement.style.setProperty('--background-color-ct', `#${config.color!.background}${opacity}`);
        document.documentElement.style.setProperty('--background-color-ct2', `#${config.color!.background}${opacityDouble}`);
        document.documentElement.style.setProperty('--background-color-10l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-10l-ct', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacity}`, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-10l-ct2', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacityDouble}`, backgroundFactor * 10)}`);
        document.documentElement.style.setProperty('--background-color-20l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-20l-ct', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacity}`, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-20l-ct2', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacityDouble}`, backgroundFactor * 20)}`);
        document.documentElement.style.setProperty('--background-color-30l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-30l-ct', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacity}`, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-30l-ct2', `${Color.lightenDarkenColor(`#${config.color!.background!}${opacityDouble}`, backgroundFactor * 30)}`);
        document.documentElement.style.setProperty('--background-color-40l', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * 40)}`);
        document.documentElement.style.setProperty('--background-color-10d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -10)}`);
        document.documentElement.style.setProperty('--background-color-20d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -20)}`);
        document.documentElement.style.setProperty('--background-color-30d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -30)}`);
        document.documentElement.style.setProperty('--background-color-40d', `${Color.lightenDarkenColor(`#${config.color!.background!}`, backgroundFactor * -40)}`);
        document.documentElement.style.setProperty('--color-shadow1', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -10)}`);
        document.documentElement.style.setProperty('--color-shadow2', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -20)}`);
        document.documentElement.style.setProperty('--color-shadow3', `${Color.lightenDarkenColor(`#${config.color!.background!}`, shadowFactor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color', `#${config.color!.foreground}`);
        document.documentElement.style.setProperty('--foreground-color-t', `#${config.color!.foreground}BB`);
        document.documentElement.style.setProperty('--foreground-color-10t', `#${config.color!.foreground}66`);
        document.documentElement.style.setProperty('--foreground-color-10l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 10)}`);
        document.documentElement.style.setProperty('--foreground-color-20l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 20)}`);
        document.documentElement.style.setProperty('--foreground-color-30l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 30)}`);
        document.documentElement.style.setProperty('--foreground-color-40l', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * 40)}`);
        document.documentElement.style.setProperty('--foreground-color-10d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -10)}`);
        document.documentElement.style.setProperty('--foreground-color-20d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -20)}`);
        document.documentElement.style.setProperty('--foreground-color-30d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -30)}`);
        document.documentElement.style.setProperty('--foreground-color-40d', `${Color.lightenDarkenColor(`#${config.color!.foreground}`, factor * -40)}`);
        document.documentElement.style.setProperty('--highlight-color', `#${config.color!.highlight}`);
        document.documentElement.style.setProperty('--highlight-color-ct2', `#${config.color!.highlight}${opacityDouble}`);
        document.documentElement.style.setProperty('--highlight-color-10l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 10)}`);
        document.documentElement.style.setProperty('--highlight-color-20l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 20)}`);
        document.documentElement.style.setProperty('--highlight-color-30l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 30)}`);
        document.documentElement.style.setProperty('--highlight-color-40l', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * 40)}`);
        document.documentElement.style.setProperty('--highlight-color-10d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -10)}`);
        document.documentElement.style.setProperty('--highlight-color-20d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -20)}`);
        document.documentElement.style.setProperty('--highlight-color-20d-ct', `${Color.lightenDarkenColor(`#${config.color!.highlight}${opacity}`, factor * -20)}`);
        document.documentElement.style.setProperty('--highlight-color-30d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -30)}`);
        document.documentElement.style.setProperty('--highlight-color-40d', `${Color.lightenDarkenColor(`#${config.color!.highlight}`, factor * -40)}`);
        document.documentElement.style.setProperty('--highlight-color-40d-ct2', `${Color.lightenDarkenColor(`#${config.color!.highlight}${opacityDouble}`, factor * -40)}`);
        document.documentElement.style.setProperty('--color-green', `#${config.color!.green}`);
        document.documentElement.style.setProperty('--color-green-ct2', `#${config.color!.green}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-green-10t', `#${config.color!.green}66`);
        document.documentElement.style.setProperty('--color-red', `#${config.color!.red}`);
        document.documentElement.style.setProperty('--color-red-ct2', `#${config.color!.red}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-red-10t', `#${config.color!.red}66`);
        document.documentElement.style.setProperty('--color-blue', `#${config.color!.blue}`);
        document.documentElement.style.setProperty('--color-blue-ct2', `#${config.color!.blue}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-blue-10t', `#${config.color!.blue}66`);
        document.documentElement.style.setProperty('--color-yellow', `#${config.color!.yellow}`);
        document.documentElement.style.setProperty('--color-yellow-ct2', `#${config.color!.yellow}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-yellow-10t', `#${config.color!.yellow}66`);
        document.documentElement.style.setProperty('--color-magenta', `#${config.color!.magenta}`);
        document.documentElement.style.setProperty('--color-magenta-ct2', `#${config.color!.magenta}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-magenta-10t', `#${config.color!.magenta}66`);
        document.documentElement.style.setProperty('--color-cyan', `#${config.color!.cyan}`);
        document.documentElement.style.setProperty('--color-cyan-ct2', `#${config.color!.cyan}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-cyan-10t', `#${config.color!.cyan}66`);

        document.documentElement.style.setProperty('--color-white', `#${config.color!.white}`);
        document.documentElement.style.setProperty('--color-white-ct2', `#${config.color!.white}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-white-10t', `#${config.color!.white}66`);
        document.documentElement.style.setProperty('--color-black', `#${config.color!.black}`);
        document.documentElement.style.setProperty('--color-black-ct2', `#${config.color!.black}${opacityDouble}`);
        document.documentElement.style.setProperty('--color-black-10t', `#${config.color!.black}66`);
        document.documentElement.style.setProperty('--color-grey', `#555555`);
        document.documentElement.style.setProperty('--color-grey-ct2', `#555555${opacityDouble}`);
        document.documentElement.style.setProperty('--color-grey-10t', `#55555566`);
        document.documentElement.style.setProperty('--cursor-color', `#${config.cursor!.color}`);
        document.documentElement.style.setProperty('--shadow1', '0 1px 1px 0 var(--color-shadow3), 0 2px 1px -1px var(--color-shadow1), 0 1px 3px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow2', '0 2px 2px 0 var(--color-shadow3), 0 3px 1px -2px var(--color-shadow1), 0 1px 5px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--shadow3', '0 3px 4px 0 var(--color-shadow3), 0 3px 3px -2px var(--color-shadow1), 0 1px 8px 0 var(--color-shadow2)');
        document.documentElement.style.setProperty('--font-size', `${config.font!.size}px`);
        document.documentElement.style.setProperty('--font-weight', `${config.font!.weight}`);
        document.documentElement.style.setProperty('--font-family', `${config.font!.family}`);
        document.documentElement.style.setProperty('--app-font-family', `${config.font!.app!.family}`);
        document.documentElement.style.setProperty('--app-font-size', `${config.font!.app!.size}px`);
        document.documentElement.style.setProperty('--padding-xterm', `${config.padding!.top}rem ${config.padding!.right}rem ${config.padding!.bottom}rem ${config.padding!.left}rem`);
        document.documentElement.style.setProperty('--inactive-overlay-opacity', `${inactiveOpacity}`);
        if (config.terminal?.allow_transparency && config.background_image?.path) {
            const resolvedBackgroundImagePath = await this.resolveBackgroundImagePath(config.background_image.path);
            const url = Fs.convertFileSrc(resolvedBackgroundImagePath);
            const color = `#${config.color!.background}` + Color.getHexOpacity(config.background_image.opacity);

            // separate variables, no shorthand "fixed" tokens in the CSS variable
            document.body.style.setProperty("--background-image", `url("${url}")`);
            document.body.style.setProperty("--background-gradient", `linear-gradient(to bottom, ${color}, ${color})`);
            document.body.style.setProperty("--background-blur", `${config.background_image.blur}px`);

            // set switch -> activates the ::before
            document.body.classList.add("has-background");
        } else {
            // back to default
            document.body.classList.remove("has-background");
            document.body.style.removeProperty("--background-image");
            document.body.style.removeProperty("--background-gradient");
            document.body.style.removeProperty("--background-blur");
            // if you want a plain color surface:
            document.body.style.setProperty("--background-color", `#${config.color!.background!}`);
        }
    }

    private async resolveBackgroundImagePath(backgroundImagePath: string): Promise<string> {
        if (!backgroundImagePath.startsWith("~/")) {
            return backgroundImagePath;
        }

        const homeDirectoryPath = await Path.homeDir();
        const normalizedHomeDirectoryPath = homeDirectoryPath.endsWith("/")
            ? homeDirectoryPath.slice(0, -1)
            : homeDirectoryPath;
        const relativePathWithoutTilde = backgroundImagePath.slice(2);
        return `${normalizedHomeDirectoryPath}/${relativePathWithoutTilde}`;
    }

    private getShadowFactor(isLightTheme: boolean): number {
        if (isLightTheme) {
            return 1;
        }
        return 0.5;
    }

    private getBackgroundFactor(config: Config, isLightTheme: boolean) {
        const brightness = Color.getBrightness(`#${config.color!.background!}`);
        const factor = 1.8 - brightness;
        return isLightTheme ? -factor : factor;
    }
}


