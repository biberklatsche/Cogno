import {ConfigService} from "../../src/config/+state/config.service";
import {Config, ShellConfig} from "../../src/config/+models/config";
import {BehaviorSubject, Observable} from "rxjs";
import {filter} from "rxjs/operators";

export class ConfigServiceMock extends ConfigService {
    private _config$ = new BehaviorSubject<Config | undefined>(undefined);

    get config(): Config {
        return this._config$.value!;
    }

    get config$(): Observable<Config> {
        return this._config$.asObservable().pipe(filter(config => config !== undefined));
    }

    getShellConfigOrDefault(name: string | undefined): ShellConfig {
        const shell = this._config$.value?.shell;
        if(!shell?.default) throw new Error("Shell default not set");
        if(!name) return shell.profiles[shell.default];
        return shell.profiles[name];
    }

    setConfig(config: Config) {this._config$.next(config);}

    getPromptSegments(): any[] {
        return [];
    }

}
