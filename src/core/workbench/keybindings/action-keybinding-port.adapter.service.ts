import { Injectable } from "@angular/core";
import { ActionKeybindingPort } from "@cogno/core/infrastructure/keybindings/action-keybinding-port";
import { KeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/keybinding.pipe";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { OsPlatform } from "@cogno/platform/os";

@Injectable({ providedIn: "root" })
export class ActionKeybindingPortAdapterService implements ActionKeybindingPort {
  private readonly keybindingPipe: KeybindingPipe;

  constructor(
    private readonly keybindService: KeybindService,
    os: OsPlatform,
  ) {
    this.keybindingPipe = new KeybindingPipe(os);
  }

  getKeybindingLabel(actionName: string): string {
    const keybinding = this.keybindService.getKeybinding(actionName);
    return this.keybindingPipe.transform(keybinding);
  }
}
