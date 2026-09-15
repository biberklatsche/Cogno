import { describe, expect, it } from "vitest";
import { CommandDiscoveryUseCase } from "./command-discovery.use-case";

describe("CommandDiscoveryUseCase", () => {
  const state = CommandDiscoveryUseCase.updateCommandEntries(
    CommandDiscoveryUseCase.createInitialState(),
    [
      { actionDefinition: { actionName: "open_command_palette" }, keybinding: "ctrl+p" },
      { actionDefinition: { actionName: "copy" }, keybinding: "ctrl+c" },
    ],
  );

  it("filters command entries case-insensitively", () => {
    const filteredState = CommandDiscoveryUseCase.filterCommands(state, "COPY");

    expect(filteredState.filteredCommandList).toHaveLength(1);
    expect(filteredState.filteredCommandList[0].label).toBe("copy");
  });

  it("navigates through filtered entries", () => {
    const nextState = CommandDiscoveryUseCase.selectNextCommand(state, "down");

    expect(nextState.filteredCommandList[1].isSelected).toBe(true);
  });

  it("resets query and keeps the collection on close", () => {
    const filteredState = CommandDiscoveryUseCase.filterCommands(state, "copy");
    const closedState = CommandDiscoveryUseCase.handleCollectionClose(filteredState);

    expect(closedState.query).toBe("");
    expect(closedState.filteredCommandList).toHaveLength(2);
    expect(closedState.filteredCommandList[0].isSelected).toBe(true);
  });
});
