import { Pipe, PipeTransform } from "@angular/core";
import { ActionKeybindingPort } from "@cogno/shared/ports";

/** The keybinding of an action, as the user should read it - or nothing. */
@Pipe({ name: "actionkeybinding" })
export class ActionKeybindingPipe implements PipeTransform {
  constructor(private readonly keybindings: ActionKeybindingPort) {}

  transform(action: string | null | undefined): string {
    if (!action) {
      return "";
    }
    return this.keybindings.getKeybindingLabel(action);
  }
}
