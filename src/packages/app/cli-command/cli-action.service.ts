import { DestroyRef, Injectable } from "@angular/core";
import { CliActionListener } from "@cogno/app-tauri/cli-action";
import { KeybindActionInterpreter } from "../keybinding/keybind-action.interpreter";
import { CognoMessageDispatcher } from "../cogno-message/cogno-message-dispatcher.service";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(dispatcher: CognoMessageDispatcher, ref: DestroyRef) {
    CliActionListener.register((action) => {
      const actionDef = KeybindActionInterpreter.parse(action);
      dispatcher.dispatch({ action: actionDef.actionName, args: actionDef.args });
    }).then((unlisten) => {
      ref.onDestroy(() => unlisten());
    });
  }
}
