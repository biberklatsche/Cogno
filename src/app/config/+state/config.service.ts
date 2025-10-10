import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {debounceTime, filter, map, Observable, Subject} from 'rxjs';
import {Config, Theme} from "../+models/config";
import {ConfigCodec} from "./config.codec";
import {AppBus} from "../../event-bus/event-bus";
import {ConfigLoadedEvent, ThemeChangedEvent} from "../+bus/events";
import {Logger} from "../../_tauri/logger";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    config: Subject<Config | undefined> = new Subject<Config | undefined>();

    get config$(): Observable<Config> {
        return this.config.pipe(filter(s => !!s));
    }

    get activeTheme$(): Observable<Theme & { scrollbackLines: number }> {
        return this.config$.pipe(map(s => {
            return {...s.theme.default, scrollbackLines: s.general.scrollback_lines};
        }));
    }

    constructor(private appBus: AppBus, private destroy: DestroyRef) {
        appBus.onceCommand$('LoadConfigCommand').subscribe(async () => {
           this.load().then();
        });
        appBus.onceCommand$('WatchConfigCommand').subscribe(async () => {
            setTimeout(() => this.watch().then(), 1000);
        });
    }

    public async load() {
        Logger.info('Load config...');
        const path = Environment.configFilePath();
        /*invoke("list_fonts").then(fonts => {
          console.log('###############Fonts', fonts);
        }).catch(error => console.log('###############Fontseer', error));*/

        /*invoke("list_shells").then(shells => {
          console.log('###############Shells', shells);


        }).catch(error => console.log('###############Shellseer', error));*/

        /*invoke("get_keyboard_layout").then(layout => {
          console.log('###############layout', layout);
        }).catch(error => console.log('###############layoutseer', error));

        invoke('encrypt', { text: "text234", password: "password" }).then(encrypted_text => {
          console.log('###############decrypt', encrypted_text);
          invoke('decrypt', { encryptedText: encrypted_text, password: "password" }).then(text => {
            console.log('###############decryptet', text);
          }).catch(error => console.log('###############decrypteer', error));
        }).catch(error => console.log('###############encryptseer', error));*/
        await this.loadConfig(path);
    }

    public async watch() {
        Logger.info('Load and watch config...');
        const path = Environment.configFilePath();
        if(!await Fs.exists(path)) {
            await Fs.writeTextFile(path, ConfigCodec.defaultSettingsAsComment());
        }
        const unwatch = Fs.watchChanges$(path).pipe(debounceTime(50)).subscribe(async () => {
            await this.loadConfig(path);
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe());
    }


    private async loadConfig(path: string) {
        const configAsString = await Fs.readTextFile(path);
        const config = ConfigCodec.fromStringToConfig(configAsString);
        const configLoadedEvent: ConfigLoadedEvent = {type: 'ConfigLoaded', sourcePath: ['app', 'settings']};
        const themeChangedEvent: ThemeChangedEvent = {type: 'ThemeChanged', sourcePath: ['app', 'settings']};
        this.appBus.emit(configLoadedEvent);
        this.appBus.emit(themeChangedEvent);
        this.config.next(config);
        Logger.info('Config loaded...');
    }
}
