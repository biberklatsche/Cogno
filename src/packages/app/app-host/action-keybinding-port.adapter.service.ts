import { Injectable, Signal } from "@angular/core";
import { OsPlatform } from "@cogno/platform/os";
import { ActionKeybindingContract } from "@cogno/shared/ports";
import { KeybindService } from "../keybinding/keybind.service";
import { KeybindingPipe } from "../keybinding/pipe/keybinding.pipe";

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
