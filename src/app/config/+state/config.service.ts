import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {BehaviorSubject, debounceTime, filter, Observable, Subject, Subscription} from 'rxjs';
import {Config, ShellConfig, ShellConfigPosition} from "../+models/config";
import {ConfigReader} from "./config.reader";
import {Logger} from "../../_tauri/logger";
import {AppBus} from "../../app-bus/app-bus";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ShellConfigurator} from "../shell-configurator";
import {DefaultConfig} from "../../_tauri/default-config";
import {ConfigWriter} from "./config.writer";
import {ActionFired} from "../../action/action.models";
import {Opener} from "../../_tauri/opener";

export abstract class ConfigService {
    abstract get config(): Config;
    abstract get config$(): Observable<Config>;
    abstract getShellConfigOrDefault(pos: ShellConfigPosition): ShellConfig;
}

@Injectable()
export class RealConfigService extends ConfigService{
    private _config: BehaviorSubject<Config | undefined> = new BehaviorSubject<Config | undefined>(undefined);

    private _unwatch: Subscription | undefined;

    get config(): Config {
        if(this._config === undefined) throw new Error('Config is not loaded!');
        return this._config.value!;
    }

    get config$(): Observable<Config> {
        return this._config.pipe(filter(s => !!s));
    }

    getShellConfigOrDefault(shellConfigPosition: ShellConfigPosition): ShellConfig {
        const config = this._config.value;
        if(!config) throw new Error('Config is not loaded!');
        let shellConfig = config.shell![shellConfigPosition];
        if (!shellConfig) {
            shellConfig = config.shell![1];
        }
        if(!shellConfig) throw new Error('No shell config defined!');
        return {...shellConfig};
    }

    constructor(private appBus: AppBus, private destroy: DestroyRef, private shells: ShellConfigurator) {
        super();
        appBus.onceType$('InitConfigCommand').pipe(takeUntilDestroyed(destroy)).subscribe(async () => {
            await this.loadConfig();
        });
        appBus.on$(ActionFired.listener()).subscribe(async (event) => {
           if (event.payload === 'open_config') {
               await Opener.openPath(Environment.configFilePath())
           }
        });
        appBus.on$(ActionFired.listener()).subscribe(async (event) => {
            if (event.payload === 'load_config') {
                await this.loadConfig();
                this.appBus.publish({type: 'Notification', path: ['notification'], payload: {header: 'System', body: 'Config loaded'}});
            }
        });
    }

    private async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();
        this._unwatch = Fs.watchChanges$(path, {delayMs: 1000}).pipe(takeUntilDestroyed(this.destroy)).subscribe(async () => {
            await this.loadConfig();
            this.appBus.publish({type: 'Notification', path: ['notification'], payload: {header: 'System', body: 'Config loaded'}});
        });
    }

    private async loadConfig() {
        this._unwatch?.unsubscribe();
        const configDir = Environment.configDir();
        if(!await Fs.exists(configDir)) {
            await Fs.mkdir(configDir);
        }
        const path = Environment.configFilePath();
        if(!await Fs.exists(path)) {
            const userConfig: Config = {
                shell: {}};
            await this.shells.apply(userConfig);
            await Fs.writeTextFile(path, ConfigWriter.toDotString(userConfig));
        }
        const defaultConfigString = await DefaultConfig.read();
        const userConfigString = await Fs.readTextFile(path);
        const config = ConfigReader.fromStringToConfig(defaultConfigString, userConfigString);
        if(config.enable_watch_config) {
            setTimeout(async () => {
                await this.watch();
            }, 1000);
        }
        this._config.next(config);
        this.appBus.publish({type: 'ConfigLoaded', path: ['app', 'settings']});
        Logger.info('Config loaded...');
    }
}
