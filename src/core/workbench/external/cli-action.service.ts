import { DestroyRef, Injectable } from "@angular/core";
import { KeybindActionInterpreter } from "@cogno/core/infrastructure/keybindings/keybind-action.interpreter";
import { ActionRunner } from "@cogno/core/workbench/actions/action-runner";
import { AppBus } from "@cogno/core/workbench/bus/app-bus";
import { CliActionListener } from "@cogno/platform/cli-action";
import { Logger } from "@cogno/platform/logger";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(
    private readonly cliActions: CliActionListener,
    actionRunner: ActionRunner,
    appBus: AppBus,
    ref: DestroyRef,
  ) {
    // A second start with --config or --set: the user expects a Cogno with
    // those, and would otherwise see nothing happen at all.
    this.cliActions
      .registerNotice((notice) => {
        appBus.publish({
          type: "Notification",
          payload: { header: "Command line", body: notice, type: "warning" },
        });
      })
      .then((unlisten) => {
        ref.onDestroy(() => unlisten());
      });
    this.cliActions
      .register((action) => {
        const actionDef = KeybindActionInterpreter.parse(action);
        const status = actionRunner.run(actionDef.actionName, actionDef.args);
        // The single-instance CLI path is fire-and-forget; the outcome is only
        // logged here. `cogno action run` gets a real reply over HTTP.
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
