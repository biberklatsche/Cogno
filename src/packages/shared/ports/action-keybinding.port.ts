export interface ActionKeybindingContract {
  getKeybindingLabel(actionName: string): string;
}

export abstract class ActionKeybindingPort implements ActionKeybindingContract {
  abstract getKeybindingLabel(actionName: string): string;
}
