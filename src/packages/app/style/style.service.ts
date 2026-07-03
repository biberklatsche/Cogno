import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Fs } from "@cogno/app-tauri/fs";
import { Logger } from "@cogno/app-tauri/logger";
import { Path } from "@cogno/app-tauri/path";
import { Color } from "../common/color/color";
import { Config } from "../config/+models/config";
import { ConfigService } from "../config/+state/config.service";

@Injectable({
  providedIn: "root",
})
export class StyleService {
  constructor(configService: ConfigService, destroyRef: DestroyRef) {
    Logger.info("StyleService constructor");
    configService.config$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((config) => void this.setStyle(config));
  }

  private async setStyle(config: Config): Promise<void> {
    Logger.info("Set Css-Variables...");
    const isLightTheme = Color.isLight(`#${config.color?.background}`);
    const backgroundFactor = this.getBackgroundFactor(config, isLightTheme);
    const shadowFactor = this.getShadowFactor(isLightTheme);
    const menuOpacity = config.menu?.opacity ?? 100;
    const menuOpacity2 = menuOpacity === 100 ? 100 : menuOpacity / 2;
    const inactiveOpacity = (config.terminal?.inactive_overlay_opacity ?? 50) / 100;

    document.documentElement.style.setProperty(
      "--theme-lighten-color",
      isLightTheme ? "black" : "white",
    );
    document.documentElement.style.setProperty(
      "--theme-darken-color",
      isLightTheme ? "white" : "black",
    );
    document.documentElement.style.setProperty(
      "--background-mix-unit",
      `${(Math.abs(backgroundFactor) / 255) * 100}%`,
    );
    document.documentElement.style.setProperty(
      "--shadow-mix-unit",
      `${(shadowFactor / 255) * 100}%`,
    );
    document.documentElement.style.setProperty("--menu-opacity-ct", `${menuOpacity}%`);
    document.documentElement.style.setProperty("--menu-opacity-ct2", `${menuOpacity2}%`);

    document.documentElement.style.setProperty(
      "--background-color",
      `#${config.color?.background}`,
    );
    document.documentElement.style.setProperty(
      "--foreground-color",
      `#${config.color?.foreground}`,
    );
    document.documentElement.style.setProperty("--highlight-color", `#${config.color?.highlight}`);
    document.documentElement.style.setProperty("--color-green", `#${config.color?.green}`);
    document.documentElement.style.setProperty("--color-red", `#${config.color?.red}`);
    document.documentElement.style.setProperty("--color-blue", `#${config.color?.blue}`);
    document.documentElement.style.setProperty("--color-yellow", `#${config.color?.yellow}`);
    document.documentElement.style.setProperty("--color-magenta", `#${config.color?.magenta}`);
    document.documentElement.style.setProperty("--color-cyan", `#${config.color?.cyan}`);
    document.documentElement.style.setProperty("--color-white", `#${config.color?.white}`);
    document.documentElement.style.setProperty("--color-black", `#${config.color?.black}`);
    document.documentElement.style.setProperty("--color-grey", `#555555`);
    document.documentElement.style.setProperty("--cursor-color", `#${config.cursor?.color}`);
    const shadow1 =
      "color-mix(in srgb, var(--theme-darken-color) calc(var(--shadow-mix-unit) * var(--mix-step-1)), var(--background-color))";
    const shadow2 =
      "color-mix(in srgb, var(--theme-darken-color) calc(var(--shadow-mix-unit) * var(--mix-step-2)), var(--background-color))";
    const shadow3 =
      "color-mix(in srgb, var(--theme-darken-color) calc(var(--shadow-mix-unit) * var(--mix-step-3)), var(--background-color))";
    document.documentElement.style.setProperty(
      "--shadow1",
      `0 1px 1px 0 ${shadow3}, 0 2px 1px -1px ${shadow1}, 0 1px 3px 0 ${shadow2}`,
    );
    document.documentElement.style.setProperty(
      "--shadow2",
      `0 2px 2px 0 ${shadow3}, 0 3px 1px -2px ${shadow1}, 0 1px 5px 0 ${shadow2}`,
    );
    document.documentElement.style.setProperty(
      "--shadow3",
      `0 3px 4px 0 ${shadow3}, 0 3px 3px -2px ${shadow1}, 0 1px 8px 0 ${shadow2}`,
    );
    document.documentElement.style.setProperty("--font-size", `${config.font?.size}px`);
    document.documentElement.style.setProperty("--font-weight", `${config.font?.weight}`);
    document.documentElement.style.setProperty("--font-family", `${config.font?.family}`);
    document.documentElement.style.setProperty("--app-font-family", `${config.font?.app?.family}`);
    document.documentElement.style.setProperty("--app-font-size", `${config.font?.app?.size}px`);
    document.documentElement.style.setProperty(
      "--padding-xterm",
      `${config.padding?.top}rem ${config.padding?.right}rem ${config.padding?.bottom}rem ${config.padding?.left}rem`,
    );
    document.documentElement.style.setProperty("--inactive-overlay-opacity", `${inactiveOpacity}`);
    if (config.terminal?.allow_transparency && config.background_image?.path) {
      const resolvedBackgroundImagePath = await this.resolveBackgroundImagePath(
        config.background_image.path,
      );
      const url = Fs.convertFileSrc(resolvedBackgroundImagePath);
      const color = `#${config.color?.background}${Color.getHexOpacity(config.background_image.opacity)}`;

      // separate variables, no shorthand "fixed" tokens in the CSS variable
      document.body.style.setProperty("--background-image", `url("${url}")`);
      document.body.style.setProperty(
        "--background-gradient",
        `linear-gradient(to bottom, ${color}, ${color})`,
      );
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
      document.body.style.setProperty("--background-color", `#${config.color?.background}`);
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
    const brightness = Color.getBrightness(`#${config.color?.background}`);
    const factor = 1.8 - brightness;
    return isLightTheme ? -factor : factor;
  }
}
