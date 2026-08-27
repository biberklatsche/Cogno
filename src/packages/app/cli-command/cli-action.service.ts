import { DestroyRef, Injectable } from "@angular/core";
import { CliActionListener } from "@cogno/platform/cli-action";
import { ActionDispatcher } from "@cogno/shared/ports";
import { KeybindActionInterpreter } from "../keybinding/keybind-action.interpreter";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(
    private readonly cliActions: CliActionListener,
    dispatcher: ActionDispatcher,
    ref: DestroyRef,
  ) {
    this.cliActions
      .register((action) => {
        const actionDef = KeybindActionInterpreter.parse(action);
        dispatcher.dispatchAction({ actionName: actionDef.actionName, args: actionDef.args });
      })
      .then((unlisten) => {
        ref.onDestroy(() => unlisten());
      });
  }
}
