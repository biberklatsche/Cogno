import { CommandPaletteCommandEntryContract } from "@cogno/core-api";
import { CommandPaletteEntryState, CommandPaletteState } from "./command-palette-state";

export type CommandPaletteNavigationDirection = "up" | "down" | "left" | "right";

export class CommandPaletteUseCase {
  static createInitialState(): CommandPaletteState {
    return {
      commandList: [],
      filteredCommandList: [],
      query: "",
    };
  }

  static handleSideMenuOpen(state: CommandPaletteState): CommandPaletteState {
    return this.filterCommands(state, state.query);
  }

  static handleSideMenuClose(state: CommandPaletteState): CommandPaletteState {
    const resetCommandList = this.withFirstSelected(
      state.commandList.map((commandEntry) => ({
        ...commandEntry,
        isSelected: false,
      })),
    );

    return {
      ...state,
      query: "",
      filteredCommandList: resetCommandList,
    };
  }

  static updateCommandEntries(
    state: CommandPaletteState,
    commandEntries: ReadonlyArray<CommandPaletteCommandEntryContract>,
  ): CommandPaletteState {
    const commandList = this.withFirstSelected(
      commandEntries
        .map((commandEntry) => ({
          isSelected: false,
          label: commandEntry.actionDefinition.actionName.replaceAll("_", " "),
          keybinding: commandEntry.keybinding,
          actionDefinition: commandEntry.actionDefinition,
        }))
        .sort((firstEntry, secondEntry) => firstEntry.label.localeCompare(secondEntry.label)),
    );

    return this.filterCommands(
      {
        ...state,
        commandList,
      },
      state.query,
    );
  }

  static filterCommands(state: CommandPaletteState, query: string): CommandPaletteState {
    const normalizedQuery = query.toLowerCase();
    const filteredCommandList = this.withFirstSelected(
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
    state: CommandPaletteState,
    direction: CommandPaletteNavigationDirection,
    resolveNavigationTarget?: (
      activeCommandLabel: string,
      direction: CommandPaletteNavigationDirection,
    ) => string | undefined,
  ): CommandPaletteState {
    const currentFilteredCommandList = state.filteredCommandList;
    if (currentFilteredCommandList.length === 0) {
      return state;
    }

    const selectedIndex = currentFilteredCommandList.findIndex((commandEntry) => commandEntry.isSelected);
    const nextIndex = this.resolveNextIndex(currentFilteredCommandList, selectedIndex, direction, resolveNavigationTarget);
    const updatedCommandList = currentFilteredCommandList.map((commandEntry, index) => ({
      ...commandEntry,
      isSelected: index === nextIndex,
    }));

    return {
      ...state,
      filteredCommandList: updatedCommandList,
    };
  }

  static getSelectedEntry(
    state: CommandPaletteState,
    commandEntry?: CommandPaletteEntryState,
  ): CommandPaletteEntryState | undefined {
    return commandEntry ?? state.filteredCommandList.find((entry) => entry.isSelected);
  }

  private static withFirstSelected(commandEntries: ReadonlyArray<CommandPaletteEntryState>): CommandPaletteEntryState[] {
    if (commandEntries.length === 0) {
      return [...commandEntries];
    }

    return commandEntries.map((commandEntry, index) => ({
      ...commandEntry,
      isSelected: index === 0,
    }));
  }

  private static resolveNextIndex(
    commandEntries: ReadonlyArray<CommandPaletteEntryState>,
    currentIndex: number,
    direction: CommandPaletteNavigationDirection,
    resolveNavigationTarget?: (
      activeCommandLabel: string,
      direction: CommandPaletteNavigationDirection,
    ) => string | undefined,
  ): number {
    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
    const activeCommandLabel = commandEntries[safeCurrentIndex]?.label;
    const nextId = activeCommandLabel
      ? resolveNavigationTarget?.(activeCommandLabel, direction)
      : undefined;

    if (nextId) {
      const nextIndex = commandEntries.findIndex((commandEntry) => commandEntry.label === nextId);
      if (nextIndex >= 0) {
        return nextIndex;
      }
    }

    if (direction === "down" || direction === "right") {
      return (safeCurrentIndex + 1) % commandEntries.length;
    }

    return (safeCurrentIndex - 1 + commandEntries.length) % commandEntries.length;
  }
}
