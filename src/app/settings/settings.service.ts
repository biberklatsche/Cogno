import { Injectable } from '@angular/core';
import {Fs} from "../_tauri/fs";
import {Path} from "../_tauri/path";
import {Environment} from '../environment/environment';
import {invoke} from '@tauri-apps/api/core';
import {Settings} from './models/settings';
import {DEFAULT_SETTINGS} from './models/default-settings';
import {Observable, Subject} from 'rxjs';

const configFileName = 'settings.json';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private _settings: Subject<Settings> = new Subject();

  get settings(): Observable<Settings> {
    return this._settings.asObservable();
  }

  constructor() { }

  public async loadAndWatch(): Promise<void> {
    const path = await Path.join(Environment.configDir(), configFileName);

    invoke("list_fonts").then(fonts => {
      console.log('###############Fonts', fonts);
    }).catch(error => console.log('###############Fontseer', error));

    invoke("list_shells").then(shells => {
      console.log('###############Shells', shells);
    }).catch(error => console.log('###############Shellseer', error));

    invoke("get_keyboard_layout").then(layout => {
      console.log('###############layout', layout);
    }).catch(error => console.log('###############layoutseer', error));

    invoke('encrypt', { text: "text234", password: "password" }).then(encrypted_text => {
      console.log('###############decrypt', encrypted_text);
      invoke('decrypt', { encryptedText: encrypted_text, password: "password" }).then(text => {
        console.log('###############decryptet', text);
      }).catch(error => console.log('###############decrypteer', error));
    }).catch(error => console.log('###############encryptseer', error));



    if(await Fs.exist(path)) {
      const settingsAsString = await Fs.readTextFile(path);
      const settings: Settings = JSON.parse(settingsAsString);
      if(!settings.general) settings.general = DEFAULT_SETTINGS.general;
      if(!settings.shortcuts) settings.shortcuts = DEFAULT_SETTINGS.shortcuts;
      if(!settings.themes || settings.themes.length === 0) settings.themes = DEFAULT_SETTINGS.themes;
      if(!settings.shells || settings.shells.length === 0) settings.shells = DEFAULT_SETTINGS.shells;
      if(!settings.remoteShells || settings.remoteShells.length === 0) settings.remoteShells = DEFAULT_SETTINGS.remoteShells;
      if(!settings.autocomplete ) settings.autocomplete = DEFAULT_SETTINGS.autocomplete;
      this._settings.next(settings);
    } else {
      this._settings.next(DEFAULT_SETTINGS);
    }
  }
}
