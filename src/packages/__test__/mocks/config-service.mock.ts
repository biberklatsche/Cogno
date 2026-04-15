import { BehaviorSubject, type Observable } from "rxjs";
import { filter } from "rxjs/operators";
import type { Config } from "../../app/config/+models/config";
import type { ShellProfile } from "../../app/config/+models/shell-config";
import { ConfigService, type ShellProfileEntry } from "../../app/config/+state/config.service";

export class ConfigServiceMock extends ConfigService {
  private _config$ = new BehaviorSubject<Config | undefined>(undefined);

  get config(): Config {
    return this._config$.value!;
  }

  get config$(): Observable<Config> {
    return this._config$.asObservable().pipe(filter((config) => config !== undefined));
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
