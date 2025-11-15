import {DestroyRef, Injectable} from '@angular/core';
import {CliCommandListener} from "../_tauri/cli-command";
import {AppBus} from "../app-bus/app-bus";
import {KeybindActionInterpreter} from "../keybinding/keybind-action.interpreter";

@Injectable({
  providedIn: 'root'
})
export class CliCommandService {
  constructor(bus: AppBus, ref: DestroyRef) {
      CliCommandListener.register(command => {
          const actionDef = KeybindActionInterpreter.parse(command);
        bus.publish({type: 'ActionFired', payload: actionDef.actionName, trigger: actionDef.trigger, args: actionDef.args, path: ['app', 'action']});
      }).then(unlisten => {
          ref.onDestroy(() => unlisten())
      });
  }
}
