import {DestroyRef, Injectable} from '@angular/core';
import {CommandType, TauriCommandListener} from "../_tauri/command";
import {ActionBase, AppBus} from "../app-bus/app-bus";

export type CommandFiredEvent = ActionBase<"CommandFired", CommandType>


@Injectable({
  providedIn: 'root'
})
export class CommandService {
  constructor(bus: AppBus, ref: DestroyRef) {
      TauriCommandListener.register(command => {
        bus.publish({type: 'CommandFired', payload: command});
      }).then(unlisten => {
          ref.onDestroy(() => unlisten())
      });
  }
}
