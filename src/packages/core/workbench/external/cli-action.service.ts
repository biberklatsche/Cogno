import { DestroyRef, Injectable } from "@angular/core";
import { KeybindActionInterpreter } from "@cogno/core/infrastructure/keybindings/keybind-action.interpreter";
import { CliActionListener } from "@cogno/platform/cli-action";
import { ActionDispatcher } from "@cogno/shared/ports";

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
