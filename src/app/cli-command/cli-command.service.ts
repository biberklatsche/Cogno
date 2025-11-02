import {DestroyRef, Injectable} from '@angular/core';
import {CliCommandListener} from "../_tauri/cli-command";
import {ActionBase, AppBus} from "../app-bus/app-bus";
import {ActionName} from "../config/+models/config";


export type CliCommandType = ActionName;
export type CliCommandFiredEvent = ActionBase<"CliCommandFired", CliCommandType>


@Injectable({
  providedIn: 'root'
})
export class CliCommandService {
  constructor(bus: AppBus, ref: DestroyRef) {
      CliCommandListener.register(command => {
        bus.publish({type: 'CliCommandFired', payload: command});
      }).then(unlisten => {
          ref.onDestroy(() => unlisten())
      });
  }
}
