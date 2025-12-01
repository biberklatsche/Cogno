import {DestroyRef, Injectable} from '@angular/core';
import {CliActionListener} from "../_tauri/cli-action";
import {AppBus} from "../app-bus/app-bus";
import {KeybindActionInterpreter} from "../keybinding/keybind-action.interpreter";

@Injectable({
  providedIn: 'root'
})
export class CliActionService {
  constructor(bus: AppBus, ref: DestroyRef) {
      CliActionListener.register(action => {
          const actionDef = KeybindActionInterpreter.parse(action);
        bus.publish({type: 'ActionFired', payload: actionDef.actionName, trigger: actionDef.trigger, args: actionDef.args, path: ['app', 'action']});
      }).then(unlisten => {
          ref.onDestroy(() => unlisten())
      });
  }
}
