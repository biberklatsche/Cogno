import { DestroyRef, Injectable } from "@angular/core";
import { CliActionListener } from "@cogno/app-tauri/cli-action";
import { ActionFired } from "../action/action.models";
import { AppBus } from "../app-bus/app-bus";
import { KeybindActionInterpreter } from "../keybinding/keybind-action.interpreter";

@Injectable({
  providedIn: "root",
})
export class CliActionService {
  constructor(bus: AppBus, ref: DestroyRef) {
    CliActionListener.register((action) => {
      const actionDef = KeybindActionInterpreter.parse(action);
      bus.publish(ActionFired.createFromDefinition(actionDef));
    }).then((unlisten) => {
      ref.onDestroy(() => unlisten());
    });
  }
}
