import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {filter, map, Observable, Subject, take} from 'rxjs';
import {Config, Theme} from "../+models/config";
import {ConfigCodec} from "./config.codec";

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    config: Subject<Config | undefined> = new Subject<Config | undefined>();

    get config$(): Observable<Config> {
        return this.config.pipe(filter(s => !!s));
    }

    get onConfigFirstLoaded(): Observable<boolean> {
        return this.config$.pipe(map(s => !!s), take(1));
    }

    get activeTheme$(): Observable<Theme & { scrollbackLines: number }> {
        return this.config$.pipe(map(s => {
            return {...s.theme.default, scrollbackLines: s.general.scrollback_lines};
        }));
    }

    constructor(private destroy: DestroyRef) {
    }

    public async loadAndWatch(): Promise<void> {
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


        if(!await Fs.exists(path)) {
            await Fs.writeTextFile(path, ConfigCodec.defaultSettingsAsComment());
        }

        const unwatch = Fs.watchChanges$(path).subscribe(async () => {
            await this.loadConfig(path);
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe())
        await this.loadConfig(path);
    }

    private async loadConfig(path: string) {
        const configAsString = await Fs.readTextFile(path);
        this.config.next(ConfigCodec.fromStringToSettings(configAsString));
    }
}
