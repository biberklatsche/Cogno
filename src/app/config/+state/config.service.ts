import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {BehaviorSubject, debounceTime, filter, Observable} from 'rxjs';
import {Config} from "../+models/config";
import {ConfigReader} from "./config.reader";
import {ConfigWriter} from "./config.writer";
import {Logger} from "../../_tauri/logger";
import {AppBus} from "../../app-bus/app-bus";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ShellConfigurator} from "../shell-configurator";
import {DefaultConfig} from "../../_tauri/default-config";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private _config: BehaviorSubject<Config | undefined> = new BehaviorSubject<Config | undefined>(undefined);

    get config(): Config {
        if(this._config === undefined) throw new Error('Config is not loaded!');
        return this._config.value!;
    }

    get config$(): Observable<Config> {
        return this._config.pipe(filter(s => !!s));
    }

    constructor(private appBus: AppBus, private destroy: DestroyRef, private shells: ShellConfigurator) {
        appBus.onType$('LoadConfigCommand').pipe(takeUntilDestroyed(destroy)).subscribe(async () => {
            await this.loadConfig();
        });
        appBus.onceType$('WatchConfigCommand').subscribe(() => {
            setTimeout(async () => await this.watch(), 1000);
        });
    }

    private async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();
        const unwatch = Fs.watchChanges$(path).pipe(debounceTime(50)).subscribe(async () => {
            await this.loadConfig();
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe());
    }

    private async loadConfig() {
        const path = Environment.configFilePath();
        const defaultConfigString = await DefaultConfig.read();

        if(!await Fs.exists(path)) {
            const userConfig: Config = {shell: {}};
            await this.shells.apply(userConfig);
            const defaultConfigParsed = ConfigReader.fromStringToConfig(defaultConfigString, "");
            await Fs.writeTextFile(path, ConfigWriter.diffToString(defaultConfigParsed, userConfig));
        }
        const userConfigString = await Fs.readTextFile(path);
        const config = ConfigReader.fromStringToConfig(defaultConfigString, userConfigString);
        this._config.next(config);
        this.appBus.publish({type: 'ConfigLoaded', path: ['app', 'settings']});
        Logger.info('Config loaded...');
    }


}
