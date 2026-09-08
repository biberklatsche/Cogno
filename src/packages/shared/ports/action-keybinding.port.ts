// Stays in shared/: dual-consumed by core/workbench and shared/ui (the
// keybinding pipe). shared/ui cannot import core, so this port cannot move to
// core/api (step 24f).
import { Signal } from "@angular/core";

export interface ActionKeybindingContract {
  getKeybindingLabel(actionName: string): string;
  /** The keybinding label of the most recently fired action, for diagnostics UI. */
  readonly lastFiredKeybinding: Signal<string | undefined>;
}

export abstract class ActionKeybindingPort implements ActionKeybindingContract {
  abstract getKeybindingLabel(actionName: string): string;
  abstract readonly lastFiredKeybinding: Signal<string | undefined>;
}
