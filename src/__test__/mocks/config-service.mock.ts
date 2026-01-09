import {ConfigService} from "../../app/config/+state/config.service";
import {Config, ShellConfig, ShellConfigPosition} from "../../app/config/+models/config";
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

    getShellConfigOrDefault(pos: ShellConfigPosition): ShellConfig {
        if(!this._config$.value?.shell || !this._config$.value.shell[pos]) throw new Error("Shell config not set");
        return this._config$.value.shell[pos];
    }

    setConfig(config: Config) {this._config$.next(config);}

}
