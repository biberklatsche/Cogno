import { Injectable } from '@angular/core';
import {Fs} from "../_tauri/fs";
import {Path} from "../_tauri/path";
import {Environment} from '../environment/environment';

const configFileName = 'settings.json';

@Injectable({
  providedIn: 'root'
})
export class SettingsFileService {

  constructor() { }

  public async loadAndWatch(): Promise<void> {
    const path = await Path.join(Environment.cognoDir(), configFileName);
    if(await Fs.exist(path)) {
      const configAsString = await Fs.readTextFile(path);
      console.log('############', configAsString);
    } else {
      console.log('############ could not load', path);
    }
  }
}
