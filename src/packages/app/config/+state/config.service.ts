import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppWiringService } from "@cogno/app/app-host/app-wiring.service";
import { CliConfigOverrides } from "@cogno/app-tauri/cli-config-overrides";
import { DefaultConfig } from "@cogno/app-tauri/default-config";
import { Fs } from "@cogno/app-tauri/fs";
import { Logger } from "@cogno/app-tauri/logger";
import { Opener } from "@cogno/app-tauri/opener";
import { Path } from "@cogno/app-tauri/path";
import { BehaviorSubject, filter, Observable, Subscription } from "rxjs";
import { ActionFired } from "../../action/action.models";
import { AppBus } from "../../app-bus/app-bus";
import { Environment } from "../../common/environment/environment";
import { Hash } from "../../common/hash/hash";
import { Config } from "../+models/config";
import { PromptSegment } from "../+models/prompt-config";
import { ShellProfile } from "../+models/shell-config";
import { ShellConfigurator } from "../shell-configurator";
import { ShellIntegrationWriter } from "../shell-integration.writer";
import { ConfigReader } from "./config.reader";
import { InitialConfigOverridesWriter } from "./initial-config-overrides.writer";

export interface ShellProfileEntry {
  readonly name: string;
  readonly profile: ShellProfile;
  readonly isDefault: boolean;
}

export abstract class ConfigService {
  abstract get config(): Config;
  abstract get config$(): Observable<Config>;

  /**
   * Returns the shell config for a given profile name.
   * If name is missing or invalid, default is used.
   */
  abstract getShellProfileOrDefault(name?: string): ShellProfile;
  abstract getOrderedShellProfiles(limit?: number): ShellProfileEntry[];
  abstract getShellProfileByShortcutIndex(index: number): ShellProfileEntry | undefined;

  abstract getPromptSegments(): PromptSegment[];
}

@Injectable()
export class RealConfigService extends ConfigService {
  private _config = new BehaviorSubject<Config | undefined>(undefined);
  private _unwatch: Subscription | undefined;
  private lastDiagnosticsHash?: number;

  get config(): Config {
    if (!this._config.value) {
      throw new Error("Config is not loaded!");
    }
    return this._config.value;
  }

  get config$(): Observable<Config> {
    return this._config.pipe(filter(Boolean));
  }

  /**
   * New API: resolve shell config by profile name
   */
  getShellProfileOrDefault(name?: string): ShellProfile {
    const config = this._config.value;
    if (!config) throw new Error("Config is not loaded!");

    const shell = config.shell;
    if (!shell || !shell.profiles) {
      throw new Error("No shell configuration defined!");
    }

    const profiles = shell.profiles;
    const profileNames = Object.keys(profiles);

    if (profileNames.length === 0) {
      throw new Error("No shell profiles defined!");
    }

    // 1) Explicit name
    if (name && profiles[name]) {
      return { ...profiles[name] };
    }

    // 2) Default
    if (shell.default && profiles[shell.default]) {
      return { ...profiles[shell.default] };
    }

    // 3) Fallback: first profile
    return { ...profiles[profileNames[0]] };
  }

  getOrderedShellProfiles(limit?: number): ShellProfileEntry[] {
    const config = this._config.value;
    if (!config) throw new Error("Config is not loaded!");

    const shell = config.shell;
    if (!shell?.profiles) {
      return [];
    }

    const orderedNames: string[] = [];
    const profileNames = Object.keys(shell.profiles);
    const appendIfValid = (profileName: string | undefined) => {
      if (!profileName || !shell.profiles[profileName] || orderedNames.includes(profileName)) {
        return;
      }
      orderedNames.push(profileName);
    };

    appendIfValid(shell.default);
    for (const profileName of shell.order ?? []) {
      appendIfValid(profileName);
    }
    for (const profileName of profileNames) {
      appendIfValid(profileName);
    }

    const profiles = orderedNames.map((profileName) => ({
      name: profileName,
      profile: { ...shell.profiles[profileName] },
      isDefault: profileName === shell.default,
    }));

    return limit === undefined ? profiles : profiles.slice(0, limit);
  }

  getShellProfileByShortcutIndex(index: number): ShellProfileEntry | undefined {
    if (index < 1 || index > 9) {
      return undefined;
    }
    return this.getOrderedShellProfiles(9)[index - 1];
  }

  getPromptSegments(): PromptSegment[] {
    const config = this._config.value;
    if (!config) throw new Error("Config is not loaded!");

    const prompt = config.prompt;
    if (!prompt || !prompt.profile) {
      throw new Error("No prompt configuration defined!");
    }

    const profile = prompt.profile;
    const activeProfileName = prompt.active;
    const order = profile[activeProfileName].order;
    const segments: PromptSegment[] = [];
    for (const segmentName of order) {
      segments.push(prompt.segment[segmentName]);
    }
    return segments;
  }

  constructor(
    private appBus: AppBus,
    private destroy: DestroyRef,
    private shells: ShellConfigurator,
    private wiringService: AppWiringService,
  ) {
    super();

    this.appBus
      .onceType$("InitConfigCommand")
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(async () => {
        await this.loadConfig();
      });

    this.appBus.on$(ActionFired.listener()).subscribe(async (event) => {
      if (event.payload === "open_config") {
        await Opener.openPath(Environment.configFilePath());
      }
    });

    this.appBus.on$(ActionFired.listener()).subscribe(async (event) => {
      if (event.payload === "load_config") {
        await this.loadConfig();
        this.appBus.publish({
          type: "Notification",
          path: ["notification"],
          payload: { header: "System", body: "Config loaded" },
        });
      }
    });
  }

  private async watch() {
    Logger.info("Load and watch config...");
    const path = Environment.configFilePath();

    this._unwatch = Fs.watchChanges$(path, { delayMs: 1000 })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(async () => {
        await this.loadConfig();
        this.appBus.publish({
          type: "Notification",
          path: ["notification"],
          payload: { header: "System", body: "Config loaded" },
        });
      });
  }

  private async loadConfig() {
    this._unwatch?.unsubscribe();
    const settingsExtensions = this.wiringService.getSettingsExtensions();

    const configDir = Environment.configDir();
    if (!(await Fs.exists(configDir))) {
      await Fs.mkdir(configDir);
    }

    const path = Environment.configFilePath();
    const configFileDirectoryPath = await Path.dirname(path);
    if (!(await Fs.exists(configFileDirectoryPath))) {
      await Fs.mkdir(configFileDirectoryPath, { recursive: true });
    }

    const defaultConfigString = await DefaultConfig.read();

    if (!(await Fs.exists(path))) {
      const userConfig = ConfigReader.fromStringToConfig(
        defaultConfigString,
        "",
        settingsExtensions,
      );
      await this.shells.apply(userConfig, this.wiringService.getShellSupportDefinitions());
      const defaultConfig = ConfigReader.fromStringToConfig(
        defaultConfigString,
        "",
        settingsExtensions,
      );
      await Fs.writeTextFile(
        path,
        InitialConfigOverridesWriter.toDotString(userConfig, defaultConfig),
      );
    }

    let userConfigString = await Fs.readTextFile(path);
    userConfigString = await this.applyCliSetOverrides(userConfigString);
    const { config, diagnostics } = ConfigReader.fromStringToConfigWithDiagnostics(
      defaultConfigString,
      userConfigString,
      settingsExtensions,
    );

    // Ensure shell integration scripts are installed
    await ShellIntegrationWriter.ensure(this.wiringService.getShellSupportDefinitions());

    if (config.enable_watch_config) {
      await this.watch();
    }

    this._config.next(config);
    this.appBus.publish({ type: "ConfigLoaded", path: ["app", "settings"] });
    Logger.info("Config loaded...");

    if (diagnostics.length > 0) {
      const diagnosticsHash = Hash.create(JSON.stringify(diagnostics));
      if (this.lastDiagnosticsHash === diagnosticsHash) {
        return;
      }
      this.lastDiagnosticsHash = diagnosticsHash;
      const errors = diagnostics.filter((d) => d.level === "error");
      const warnings = diagnostics.filter((d) => d.level === "warning");
      const header = errors.length > 0 ? "Config errors" : "Config warnings";
      const lines: string[] = [];
      if (errors.length > 0) lines.push(`Errors: ${errors.length}`);
      if (warnings.length > 0) lines.push(`Warnings: ${warnings.length}`);
      const detailLines = diagnostics.slice(0, 6).map((d) => `- ${d.message}`);
      if (diagnostics.length > 6) {
        detailLines.push(`- ...and ${diagnostics.length - 6} more`);
      }
      const body = [...lines, ...detailLines].join("\n");
      this.appBus.publish({
        type: "Notification",
        path: ["notification"],
        payload: {
          header,
          body,
          type: errors.length > 0 ? "error" : "warning",
        },
      });
    } else {
      this.lastDiagnosticsHash = undefined;
    }
  }

  private async applyCliSetOverrides(userConfigString: string): Promise<string> {
    const serializedCliOverrides = await CliConfigOverrides.getSerializedOverrides();
    if (!serializedCliOverrides || serializedCliOverrides.trim().length === 0) {
      return userConfigString;
    }

    const normalizedUserConfig = userConfigString.trimEnd();
    const normalizedOverrides = serializedCliOverrides.trim();
    if (normalizedUserConfig.length === 0) {
      return normalizedOverrides;
    }

    return `${normalizedUserConfig}\n${normalizedOverrides}`;
  }
}
