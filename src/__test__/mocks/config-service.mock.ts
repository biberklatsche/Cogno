import type { ConfigDiagnostic } from "@cogno/core/infrastructure/config/config.mapper";
import {
  type ConfigLoadOptions,
  ConfigService,
  type ShellProfileEntry,
} from "@cogno/core/infrastructure/config/config.service";
import type { Config } from "@cogno/core/infrastructure/config/models/config";
import type { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { BehaviorSubject, type Observable } from "rxjs";
import { filter } from "rxjs/operators";

export class ConfigServiceMock extends ConfigService {
  private _config$ = new BehaviorSubject<Config | undefined>(undefined);
  private _diagnostics$ = new BehaviorSubject<ReadonlyArray<ConfigDiagnostic>>([]);

  get config(): Config {
    return this._config$.value!;
  }

  get config$(): Observable<Config> {
    return this._config$.asObservable().pipe(filter((config) => config !== undefined));
  }

  /** No diagnostics in tests unless a spec pushes some. */
  get diagnostics$(): Observable<ReadonlyArray<ConfigDiagnostic>> {
    return this._diagnostics$.asObservable();
  }

  /** Emits whenever `setConfig` supplies a config, like a completed load. */
  get loaded$(): Observable<Config> {
    return this.config$;
  }

  async load(_options: ConfigLoadOptions): Promise<void> {
    // The mock is fed through setConfig; loading reads nothing.
  }

  async reload(): Promise<void> {
    // Nothing to re-read; setConfig is the only source.
  }

  setDiagnostics(diagnostics: ReadonlyArray<ConfigDiagnostic>): void {
    this._diagnostics$.next(diagnostics);
  }

  getShellProfileOrDefault(name?: string): ShellProfile {
    const shell = this._config$.value?.shell;
    if (!shell?.default) throw new Error("Shell default not set");
    if (name && shell.profiles[name]) return shell.profiles[name];
    return shell.profiles[shell.default];
  }

  getOrderedShellProfiles(limit?: number): ShellProfileEntry[] {
    const shell = this._config$.value?.shell;
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
      profile: shell.profiles[profileName],
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

  setConfig(config: Config) {
    this._config$.next(config);
  }

  getPromptSegments(): any[] {
    return [];
  }
}
