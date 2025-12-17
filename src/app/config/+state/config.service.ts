import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {BehaviorSubject, debounceTime, filter, Observable} from 'rxjs';
import {ConfigTypes} from "../+models/config.types";
import {ConfigReader} from "./config.reader";
import {Logger} from "../../_tauri/logger";
import {AppBus} from "../../app-bus/app-bus";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ShellConfigurator} from "../shell-configurator";
import {DefaultConfig} from "../../_tauri/default-config";
import {ConfigWriter} from "./config.writer";
import {ActionFired} from "../../action/action.models";
import {Opener} from "../../_tauri/opener";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    private _config: BehaviorSubject<ConfigTypes | undefined> = new BehaviorSubject<ConfigTypes | undefined>(undefined);

    get config(): ConfigTypes {
        if(this._config === undefined) throw new Error('Config is not loaded!');
        return this._config.value!;
    }

    get config$(): Observable<ConfigTypes> {
        return this._config.pipe(filter(s => !!s));
    }

    constructor(private appBus: AppBus, private destroy: DestroyRef, private shells: ShellConfigurator) {
        appBus.onType$('LoadConfigCommand').pipe(takeUntilDestroyed(destroy)).subscribe(async () => {
            await this.loadConfig();
        });
        appBus.onceType$('WatchConfigCommand').subscribe(() => {
            setTimeout(async () => {
                await this.watch();
                }, 1000);
        });
        appBus.on$(ActionFired.listener()).subscribe(async (event) => {
           if (event.payload === 'open_config') {
               await Opener.openPath(Environment.configFilePath())
           }
        });
    }

    private async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();
        const unwatch = Fs.watchChanges$(path, {delayMs: 1000}).subscribe(async () => {
            await this.loadConfig();
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe());
    }

    private async loadConfig() {
        const path = Environment.configFilePath();
        const defaultConfigString = await DefaultConfig.read();
        if(!await Fs.exists(path)) {
            const userConfig: ConfigTypes = {shell: {}};
            await this.shells.apply(userConfig);
            await Fs.writeTextFile(path, ConfigWriter.toDotString(userConfig));
        }
        const userConfigString = await Fs.readTextFile(path);
        const config = ConfigReader.fromStringToConfig(defaultConfigString, userConfigString);
        this._config.next(config);
        this.appBus.publish({type: 'ConfigLoaded', path: ['app', 'settings']});
        this.appBus.publish({type: 'Notification', path: ['notification'], payload: {header: 'Config', body: 'Config loaded'}})
        Logger.info('Config loaded...');
    }


}
