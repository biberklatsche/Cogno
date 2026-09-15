import { DestroyRef, Injectable } from "@angular/core";
import { KeybindActionInterpreter } from "@cogno/core/infrastructure/keybindings/keybind-action.interpreter";
import { ActionRunner } from "@cogno/core/workbench/actions/action-runner";
import { CliActionListener } from "@cogno/platform/cli-action";
import { Logger } from "@cogno/platform/logger";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(
    private readonly cliActions: CliActionListener,
    actionRunner: ActionRunner,
    ref: DestroyRef,
  ) {
    this.cliActions
      .register((action) => {
        const actionDef = KeybindActionInterpreter.parse(action);
        const status = actionRunner.run(actionDef.actionName, actionDef.args);
        // The single-instance CLI path is fire-and-forget; the outcome is only
        // logged here. `cogno action run` gets a real reply over HTTP (step 26g).
        if (status !== "dispatched") {
          Logger.warn(
            `CLI action "${actionDef.actionName}" ${status === "unknown" ? "is unknown" : "is not active"}.`,
          );
        }
      })
      .then((unlisten) => {
        ref.onDestroy(() => unlisten());
      });
  }
}
