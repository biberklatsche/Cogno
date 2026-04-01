import { describe, expect, it } from "vitest";
import { CommandPaletteUseCase } from "./command-palette.use-case";

describe("CommandPaletteUseCase", () => {
  const state = CommandPaletteUseCase.updateCommandEntries(
    CommandPaletteUseCase.createInitialState(),
    [
      { actionDefinition: { actionName: "open_command_palette" }, keybinding: "ctrl+p" },
      { actionDefinition: { actionName: "copy" }, keybinding: "ctrl+c" },
      { actionDefinition: { actionName: "split_right" }, keybinding: "" },
    ],
  );

  it("sorts and selects the first command", () => {
    expect(state.filteredCommandList[0].label).toBe("copy");
    expect(state.filteredCommandList[0].isSelected).toBe(true);
  });

  it("filters case-insensitively", () => {
    const filteredState = CommandPaletteUseCase.filterCommands(state, "COPY");
    expect(filteredState.filteredCommandList).toHaveLength(1);
    expect(filteredState.filteredCommandList[0].label).toBe("copy");
  });

  it("moves selection with navigation", () => {
    const nextState = CommandPaletteUseCase.selectNextCommand(state, "down");
    expect(nextState.filteredCommandList[1].isSelected).toBe(true);
  });

  it("resets the query and restores the full list on close", () => {
    const filteredState = CommandPaletteUseCase.filterCommands(state, "copy");
    const closedState = CommandPaletteUseCase.handleSideMenuClose(filteredState);
    expect(closedState.query).toBe("");
    expect(closedState.filteredCommandList).toHaveLength(3);
    expect(closedState.filteredCommandList[0].isSelected).toBe(true);
  });
});
