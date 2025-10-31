import { Injectable } from '@angular/core';
import {TauriCommandListener} from "../_tauri/command";

@Injectable({
  providedIn: 'root'
})
export class CommandService {
  constructor() {
      TauriCommandListener.register()
  }
}
