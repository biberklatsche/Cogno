import { Injectable } from "@angular/core";
import { ActionKeybindingPort } from "@cogno/core/infrastructure/keybindings/action-keybinding-port";
import { formatKeybinding } from "@cogno/core/infrastructure/keybindings/pipe/keybinding.pipe";
import { KeybindService } from "@cogno/core/workbench/keybindings/keybind.service";
import { OsPlatform } from "@cogno/platform/os";

@Injectable({ providedIn: "root" })
export class ActionKeybindingPortAdapterService implements ActionKeybindingPort {
  constructor(
    private readonly keybindService: KeybindService,
    private readonly os: OsPlatform,
  ) {}

  getKeybindingLabel(actionName: string): string {
    return formatKeybinding(this.keybindService.getKeybinding(actionName), this.os.platform());
  }
}
