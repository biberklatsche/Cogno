import { Pipe, PipeTransform } from "@angular/core";
import { OS } from "@cogno/app-tauri/os";
import { ActionName } from "../../action/action.models";
import { KeybindService } from "../keybind.service";
import { Modifier } from "../modifier";

@Pipe({
  name: "keybinding",
})
export class KeybindingPipe implements PipeTransform {
  transform(keybinding: string | null | undefined): string {
    if (!keybinding) {
      return "";
    }
    const parts = keybinding
      .split("+")
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return "";

    const modifiers = Modifier.normalizeView(parts.slice(0, -1), OS.platform());
    const key = parts[parts.length - 1];

    switch (OS.platform()) {
      case "macos":
        return [...modifiers, key].join(" ");
      default:
        return [...modifiers, key].join("+");
    }
  }
}

@Pipe({
  name: "actionkeybinding",
})
export class ActionKeybindingPipe extends KeybindingPipe {
  constructor(private keybindingService: KeybindService) {
    super();
  }

  override transform(action: ActionName | null | undefined): string {
    if (!action) {
      return "";
    }
    const keybinding = this.keybindingService.getKeybinding(action);
    return super.transform(keybinding);
  }
}
