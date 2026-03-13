import {DestroyRef, Injectable} from '@angular/core';
import {CliActionListener} from "../_tauri/cli-action";
import {AppBus} from "../app-bus/app-bus";
import {KeybindActionInterpreter} from "../keybinding/keybind-action.interpreter";
import {ActionFired} from "../action/action.models";

@Injectable({
  providedIn: 'root'
})
export class CliActionService {
  constructor(bus: AppBus, ref: DestroyRef) {
      CliActionListener.register(action => {
          const actionDef = KeybindActionInterpreter.parse(action);
        bus.publish(ActionFired.createFromDefinition(actionDef));
      }).then(unlisten => {
          ref.onDestroy(() => unlisten())
      });
  }
}
