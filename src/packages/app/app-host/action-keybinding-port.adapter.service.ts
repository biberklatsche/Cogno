import { Injectable } from "@angular/core";
import { ActionKeybindingContract } from "@cogno/core-api";
import { KeybindService } from "../keybinding/keybind.service";
import { KeybindingPipe } from "../keybinding/pipe/keybinding.pipe";

@Injectable({ providedIn: "root" })
export class ActionKeybindingPortAdapterService implements ActionKeybindingContract {
  private readonly keybindingPipe = new KeybindingPipe();

  constructor(private readonly keybindService: KeybindService) {}

  getKeybindingLabel(actionName: string): string {
    const keybinding = this.keybindService.getKeybinding(actionName);
    return this.keybindingPipe.transform(keybinding);
  }
}
