import { Injectable, Signal } from "@angular/core";
import { KeybindingPipe } from "@cogno/core/infrastructure/keybindings/pipe/keybinding.pipe";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { OsPlatform } from "@cogno/platform/os";
import { ActionKeybindingContract } from "@cogno/shared/ports";

@Injectable({ providedIn: "root" })
export class ActionKeybindingPortAdapterService implements ActionKeybindingContract {
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

  get lastFiredKeybinding(): Signal<string | undefined> {
    return this.keybindService.lastFiredKeybinding;
  }
}
