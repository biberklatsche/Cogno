import { Injectable } from '@angular/core';
import {Fs} from "../_tauri/fs";
import {Path} from "../_tauri/path";
import {Environment} from '../environment/environment';
import {invoke} from '@tauri-apps/api/core';

const configFileName = 'settings.json';

@Injectable({
  providedIn: 'root'
})
export class SettingsFileService {

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
      const configAsString = await Fs.readTextFile(path);
      console.log('############', path, configAsString);
    } else {
      console.log('############ could not load', path);
    }
  }
}
