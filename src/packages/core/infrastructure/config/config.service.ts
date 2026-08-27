import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CliConfigOverrides } from "@cogno/platform/cli-config-overrides";
import { DefaultConfig } from "@cogno/platform/default-config";
import { Fs } from "@cogno/platform/fs";
import { Logger } from "@cogno/platform/logger";
import { OsPlatform } from "@cogno/platform/os";
import { Paths } from "@cogno/platform/path";
import { ApplicationSettingsExtensionContract } from "@cogno/shared/contributions";
import { BehaviorSubject, filter, Observable, Subject, Subscription } from "rxjs";
import { Environment } from "../environment/environment";
import { ConfigDiagnostic, ConfigReader } from "./config.reader";
import { InitialConfigOverridesWriter } from "./initial-config-overrides.writer";
import { Config } from "./models/config";
import { PromptSegment } from "./models/prompt-config";
import { ShellProfile } from "./models/shell-config";

export interface ShellProfileEntry {
  readonly name: string;
  readonly profile: ShellProfile;
  readonly isDefault: boolean;
}

/**
 * What the configuration needs from layers it must not know about.
 *
 * The reader knows the file, the schema and the watch; it knows nothing about
 * shells, actions or notifications. Whoever composes the application fills
 * these in (ARCHITECTURE.md 2.1: infrastructure knows neither a session nor
 * the layout).
 */
export interface ConfigLoadOptions {
  /** Zod extensions the features contribute; the schema is built from them. */
  readonly settingsExtensions: ReadonlyArray<ApplicationSettingsExtensionContract>;
  /**
   * Fills in values that have to exist before the file is written - today the
   * shell profiles of the first start. Returns true when it changed the
   * config; then the file is written and read again.
   */
  readonly completeDefaults?: (config: Config) => Promise<boolean>;
  /** Runs after the config was read and before the file watch starts. */
  readonly beforeWatch?: (config: Config) => Promise<void>;
}

export abstract class ConfigService {
  abstract get config(): Config;
  abstract get config$(): Observable<Config>;

  /** Diagnostics of the last load; empty when the file is clean. */
  abstract get diagnostics$(): Observable<ReadonlyArray<ConfigDiagnostic>>;
  /** Emits every time a config was loaded, including reloads. */
  abstract get loaded$(): Observable<Config>;

  /** Reads the file, validates it and starts watching when enabled. */
  abstract load(options: ConfigLoadOptions): Promise<void>;
  /** Reads again with the options of the last `load`. */
  abstract reload(): Promise<void>;

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
  private _diagnostics = new BehaviorSubject<ReadonlyArray<ConfigDiagnostic>>([]);
  private _loaded = new Subject<Config>();
  private _unwatch: Subscription | undefined;
  private _options: ConfigLoadOptions | undefined;

  constructor(
    private destroy: DestroyRef,
    private readonly os: OsPlatform,
    private readonly paths: Paths,
    private readonly environment: Environment,
    private readonly fs: Fs,
  ) {
    super();
  }

  get config(): Config {
    if (!this._config.value) {
      throw new Error("Config is not loaded!");
    }
    return this._config.value;
  }

  get config$(): Observable<Config> {
    return this._config.pipe(filter(Boolean));
  }

  get diagnostics$(): Observable<ReadonlyArray<ConfigDiagnostic>> {
    return this._diagnostics.asObservable();
  }

  get loaded$(): Observable<Config> {
    return this._loaded.asObservable();
  }

  /**
   * New API: resolve shell config by profile name
   */
  getShellProfileOrDefault(name?: string): ShellProfile {
    const config = this._config.value;
    if (!config) throw new Error("Config is not loaded!");

    const shell = config.shell;
    if (!shell?.profiles) {
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
    if (!prompt?.profile) {
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

  async load(options: ConfigLoadOptions): Promise<void> {
    this._options = options;
    await this.read();
  }

  async reload(): Promise<void> {
    if (!this._options) {
      throw new Error("Config was never loaded!");
    }
    await this.read();
  }

  private async watch() {
    Logger.info("Load and watch config...");
    const path = this.environment.configFilePath();

    this._unwatch = this.fs
      .watchChanges$(path, { delayMs: 1000 })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(async () => {
        await this.read();
      });
  }

  private async read() {
    this._unwatch?.unsubscribe();
    const options = this._options;
    if (!options) {
      throw new Error("Config was never loaded!");
    }
    const settingsExtensions = options.settingsExtensions;

    const configDir = this.environment.configDir();
    if (!(await this.fs.exists(configDir))) {
      await this.fs.mkdir(configDir);
    }

    const path = this.environment.configFilePath();
    const configFileDirectoryPath = await this.paths.dirname(path);
    if (!(await this.fs.exists(configFileDirectoryPath))) {
      await this.fs.mkdir(configFileDirectoryPath, { recursive: true });
    }

    const defaultConfigString = await DefaultConfig.read();
    const defaultConfig = ConfigReader.fromStringToConfig(
      this.os.platform(),
      defaultConfigString,
      "",
      settingsExtensions,
    );
    const writeConfig = (config: Config) =>
      this.fs.writeTextFile(
        path,
        InitialConfigOverridesWriter.toDotString(config, { defaultSettings: defaultConfig }),
      );
    const readConfig = async () => {
      let userConfigString = await this.fs.readTextFile(path);
      userConfigString = await this.applyCliSetOverrides(userConfigString);
      return ConfigReader.fromStringToConfigWithDiagnostics(
        this.os.platform(),
        defaultConfigString,
        userConfigString,
        settingsExtensions,
      );
    };

    if (!(await this.fs.exists(path))) {
      const userConfig = ConfigReader.fromStringToConfig(
        this.os.platform(),
        defaultConfigString,
        "",
        settingsExtensions,
      );
      await options.completeDefaults?.(userConfig);
      await writeConfig(userConfig);
    }

    let { config, diagnostics } = await readConfig();
    if (await options.completeDefaults?.(config)) {
      await writeConfig(config);
      ({ config, diagnostics } = await readConfig());
    }

    await options.beforeWatch?.(config);

    if (config.enable_watch_config) {
      await this.watch();
    }

    this._config.next(config);
    this._loaded.next(config);
    Logger.info("Config loaded...");
    this._diagnostics.next(diagnostics);
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
