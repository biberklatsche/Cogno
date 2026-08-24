import { DestroyRef, Injectable } from "@angular/core";
import { ActionDispatcher } from "@cogno/core-api";
import { CliActionListener } from "@cogno/platform/cli-action";
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
