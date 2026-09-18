// Stays in shared/: dual-consumed by core/workbench and shared/ui (the
// keybinding pipe). shared/ui cannot import core, so this port cannot move to
// core/api (step 24f).
export interface ActionKeybindingContract {
  getKeybindingLabel(actionName: string): string;
}

export abstract class ActionKeybindingPort implements ActionKeybindingContract {
  abstract getKeybindingLabel(actionName: string): string;
}
