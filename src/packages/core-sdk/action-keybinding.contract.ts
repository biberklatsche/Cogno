import { InjectionToken } from "@angular/core";

export interface ActionKeybindingContract {
  getKeybindingLabel(actionName: string): string;
}

export const actionKeybindingToken = new InjectionToken<ActionKeybindingContract>("action-keybinding-token");
