/**
 * The keybinding of an action as the user reads it. Session and workbench
 * both show keybindings, but only the workbench knows them: it implements this.
 */
export abstract class ActionKeybindingPort {
  abstract getKeybindingLabel(actionName: string): string;
}
