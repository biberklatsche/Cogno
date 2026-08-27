import { Pipe, PipeTransform } from "@angular/core";
import { OsPlatform, OsType } from "@cogno/platform/os";
import { ActionName } from "../../action/action.models";
import { KeybindService } from "../keybind.service";
import { Modifier } from "../modifier";

export function formatKeybinding(keybinding: string | null | undefined, os: OsType): string {
  if (!keybinding) {
    return "";
  }
  const parts = keybinding
    .split("+")
    .map((k) => k.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const modifiers = Modifier.normalizeView(parts.slice(0, -1), os);
  const key = parts[parts.length - 1];

  switch (os) {
    case "macos":
      return [...modifiers, key].join(" ");
    default:
      return [...modifiers, key].join("+");
  }
}

@Pipe({
  name: "keybinding",
})
export class KeybindingPipe implements PipeTransform {
  constructor(protected readonly os: OsPlatform) {}

  transform(keybinding: string | null | undefined): string {
    return formatKeybinding(keybinding, this.os.platform());
  }
}

@Pipe({
  name: "actionkeybinding",
})
export class ActionKeybindingPipe extends KeybindingPipe {
  constructor(
    private keybindingService: KeybindService,
    os: OsPlatform,
  ) {
    super(os);
  }

  override transform(action: ActionName | null | undefined): string {
    if (!action) {
      return "";
    }
    const keybinding = this.keybindingService.getKeybinding(action);
    return super.transform(keybinding);
  }
}
