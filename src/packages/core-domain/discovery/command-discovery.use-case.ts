import { ActionEntryContract } from "@cogno/core-api";
import { SelectableListUseCase, SelectionDirection } from "../selection";
import { CommandDiscoveryEntryState, CommandDiscoveryState } from "./command-discovery-state";

export class CommandDiscoveryUseCase {
  static createInitialState(): CommandDiscoveryState {
    return {
      commandList: [],
      filteredCommandList: [],
      query: "",
    };
  }

  static handleCollectionOpen(state: CommandDiscoveryState): CommandDiscoveryState {
    return CommandDiscoveryUseCase.filterCommands(state, state.query);
  }

  static handleCollectionClose(state: CommandDiscoveryState): CommandDiscoveryState {
    return {
      ...state,
      query: "",
      filteredCommandList: SelectableListUseCase.initializeSelection(
        state.commandList.map((commandEntry) => ({
          ...commandEntry,
          isSelected: false,
        })),
      ),
    };
  }

  static updateCommandEntries(
    state: CommandDiscoveryState,
    commandEntries: ReadonlyArray<ActionEntryContract>,
  ): CommandDiscoveryState {
    const commandList = SelectableListUseCase.initializeSelection(
      commandEntries
        .map((commandEntry) => ({
          id: commandEntry.actionDefinition.actionName,
          isSelected: false,
          label: commandEntry.actionDefinition.actionName.replaceAll("_", " "),
          keybinding: commandEntry.keybinding,
          actionDefinition: commandEntry.actionDefinition,
        }))
        .sort((firstEntry, secondEntry) => firstEntry.label.localeCompare(secondEntry.label)),
    );

    return CommandDiscoveryUseCase.filterCommands(
      {
        ...state,
        commandList,
      },
      state.query,
    );
  }

  static filterCommands(state: CommandDiscoveryState, query: string): CommandDiscoveryState {
    const normalizedQuery = query.toLowerCase();
    const filteredCommandList = SelectableListUseCase.initializeSelection(
      state.commandList
        .filter((commandEntry) => commandEntry.label.toLowerCase().includes(normalizedQuery))
        .map((commandEntry) => ({ ...commandEntry, isSelected: false })),
    );

    return {
      ...state,
      query,
      filteredCommandList,
    };
  }

  static selectNextCommand(
    state: CommandDiscoveryState,
    direction: SelectionDirection,
    resolveNavigationTarget?: (
      activeCommandId: string,
      direction: SelectionDirection,
    ) => string | undefined,
  ): CommandDiscoveryState {
    const currentFilteredCommandList = state.filteredCommandList;
    if (currentFilteredCommandList.length === 0) {
      return state;
    }

    return {
      ...state,
      filteredCommandList: SelectableListUseCase.selectNext(
        currentFilteredCommandList,
        direction,
        resolveNavigationTarget,
      ),
    };
  }

  static getSelectedEntry(
    state: CommandDiscoveryState,
    commandEntry?: CommandDiscoveryEntryState,
  ): CommandDiscoveryEntryState | undefined {
    return SelectableListUseCase.getSelectedItem(state.filteredCommandList, commandEntry);
  }
}
