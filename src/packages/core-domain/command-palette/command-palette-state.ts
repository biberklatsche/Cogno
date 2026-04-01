import { CommandPaletteActionDefinitionContract } from "@cogno/core-api";

export interface CommandPaletteEntryState {
  readonly isSelected: boolean;
  readonly label: string;
  readonly keybinding: string;
  readonly actionDefinition: CommandPaletteActionDefinitionContract;
}

export interface CommandPaletteState {
  readonly commandList: ReadonlyArray<CommandPaletteEntryState>;
  readonly filteredCommandList: ReadonlyArray<CommandPaletteEntryState>;
  readonly query: string;
}
