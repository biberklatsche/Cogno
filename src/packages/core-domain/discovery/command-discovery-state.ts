import { CommandPaletteActionDefinitionContract } from "@cogno/core-api";
import { SelectableItemState } from "../selection";

export interface CommandDiscoveryEntryState extends SelectableItemState<string> {
  readonly label: string;
  readonly keybinding: string;
  readonly actionDefinition: CommandPaletteActionDefinitionContract;
}

export interface CommandDiscoveryState {
  readonly commandList: ReadonlyArray<CommandDiscoveryEntryState>;
  readonly filteredCommandList: ReadonlyArray<CommandDiscoveryEntryState>;
  readonly query: string;
}
