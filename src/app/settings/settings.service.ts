import { Injectable } from '@angular/core';
import {Fs} from "../_tauri/fs";
import {Path} from "../_tauri/path";
import {Environment} from '../environment/environment';
import {Settings, Theme} from './models/settings';
import {DEFAULT_SETTINGS} from './models/default-settings';
import {BehaviorSubject, filter, map, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  private _settings: BehaviorSubject<Settings | undefined> = new BehaviorSubject<Settings | undefined>(undefined);

  get settings$(): Observable<Settings> {
    return this._settings.pipe(filter(s => !!s));
  }

  get activeTheme$(): Observable<Theme> {
    return this.settings$.pipe(map(s => {
      const defaultTheme = s.themes.find(s => s.isDefault);
      return defaultTheme || DEFAULT_SETTINGS.themes[0];
    }));
  }

  constructor() { }

  public async loadAndWatch(): Promise<void> {
    const path = Environment.settingsFilePath();

    /*invoke("list_fonts").then(fonts => {
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
    }).catch(error => console.log('###############encryptseer', error));*/

    if(await Fs.exists(path)) {
      console.log('exists theme', path);
      const settingsAsString = await Fs.readTextFile(path);
      console.log('load theme', settingsAsString);
      const settings: Settings = JSON.parse(settingsAsString);

      if(!settings.general) settings.general = DEFAULT_SETTINGS.general;
      if(!settings.shortcuts) settings.shortcuts = DEFAULT_SETTINGS.shortcuts;
      if(!settings.themes || settings.themes.length === 0) settings.themes = DEFAULT_SETTINGS.themes;
      if(!settings.shells || settings.shells.length === 0) settings.shells = DEFAULT_SETTINGS.shells;
      if(!settings.remoteShells || settings.remoteShells.length === 0) settings.remoteShells = DEFAULT_SETTINGS.remoteShells;
      if(!settings.autocomplete ) settings.autocomplete = DEFAULT_SETTINGS.autocomplete;
      this._settings.next(settings);
      const theme = settings.themes.find(t => t.isDefault) || settings.themes[0];
    } else {
      this._settings.next(DEFAULT_SETTINGS);
    }
  }
}
