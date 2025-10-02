import {DestroyRef, Injectable} from '@angular/core';
import {Fs} from "../../_tauri/fs";
import {Environment} from '../../common/environment/environment';
import {filter, map, Observable, take} from 'rxjs';
import {createStore, Store} from '../../common/store/store';
import {DEFAULT_SETTINGS, Settings, Theme} from "../+models/settings";
import {SettingsCodec} from "./settings.codec";
import {invoke} from "@tauri-apps/api/core";

type SettingsState = {
    settings: Settings | undefined;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private store: Store<SettingsState> = createStore<SettingsState>('settings', {
        settings: undefined
    });

    get settings$(): Observable<Settings> {
        return this.store.select(s => s.settings).pipe(filter(s => !!s));
    }

    get onSettingsFirstLoaded(): Observable<boolean> {
        return this.settings$.pipe(map(s => !!s), take(1));
    }

    get activeTheme$(): Observable<Theme & { scrollbackLines: number }> {
        return this.settings$.pipe(map(s => {
            return {...s.theme.default, scrollbackLines: s.general.scrollback_lines};
        }));
    }

    constructor(private destroy: DestroyRef) {
    }

    public async loadAndWatch(): Promise<void> {
        const path = Environment.settingsFilePath();

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
            await Fs.writeTextFile(path, SettingsCodec.defaultSettingsAsComment());
        }

        const unwatch = Fs.watchChanges$(path).subscribe(async () => {
            await this.loadSettings(path);
        });
        this.destroy.onDestroy(() => unwatch.unsubscribe())
        await this.loadSettings(path);
    }

    private async loadSettings(path: string) {
        const settingsAsString = await Fs.readTextFile(path);
        this.store.update({settings: SettingsCodec.fromStringToSettings(settingsAsString)});
    }
}
