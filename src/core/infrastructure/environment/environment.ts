import { Injectable, isDevMode } from "@angular/core";
import { Logger } from "@cogno/platform/logger";
import { Paths } from "@cogno/platform/path";

/**
 * Where the application keeps its files. The paths come from Rust and are
 * asked for once at startup; everything afterwards reads them synchronously.
 * `main.ts` builds and initializes this before the application boots, so no
 * consumer can observe it half-filled.
 */
@Injectable({ providedIn: "root" })
export class Environment {
  private homeDir = "";
  private configFile = "";
  private dbFile = "";
  private exeDir = "";

  constructor(private readonly paths: Paths) {}

  /** Determines all paths. Must run before anything reads them. */
  async init(): Promise<void> {
    Logger.info("Initializing environment");
    const devMode = isDevMode();
    this.homeDir = await this.paths.cognoHomeDir(devMode);
    this.exeDir = await this.paths.exeDir();
    this.dbFile = await this.paths.cognoDbFilePath(devMode);
    this.configFile = await this.paths.cognoConfigFilePath(devMode);
    Logger.info(`Loaded ${this.homeDir}`);
  }

  /** Returns the configuration directory */
  configDir(): string {
    return this.homeDir;
  }

  /** Returns the full path to the config file */
  configFilePath(): string {
    return this.configFile;
  }

  /**
   * Returns the full path of the previous-generation database file. It is
   * only read by import migrations and may not exist.
   */
  legacyDatabaseFilePath(): string {
    return this.dbFile;
  }

  /** Returns the full path to the executable */
  exeDirPath(): string {
    return this.exeDir;
  }

  /** Returns whether we're in dev mode */
  isDevMode(): boolean {
    return isDevMode();
  }
}
