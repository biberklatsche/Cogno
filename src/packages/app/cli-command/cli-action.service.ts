import { DestroyRef, Injectable } from "@angular/core";
import { CliActionListener } from "@cogno/app-tauri/cli-action";
import { ActionDispatcher } from "@cogno/core-api";
import { KeybindActionInterpreter } from "../keybinding/keybind-action.interpreter";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(dispatcher: ActionDispatcher, ref: DestroyRef) {
    CliActionListener.register((action) => {
      const actionDef = KeybindActionInterpreter.parse(action);
      dispatcher.dispatchAction({ actionName: actionDef.actionName, args: actionDef.args });
    }).then((unlisten) => {
      ref.onDestroy(() => unlisten());
    });
  }
}
