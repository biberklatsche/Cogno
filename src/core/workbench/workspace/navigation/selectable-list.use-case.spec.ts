import { describe, expect, it } from "vitest";
import { SelectableListUseCase } from "./selectable-list.use-case";

describe("SelectableListUseCase", () => {
  it("initializes the first item when nothing is selected", () => {
    const items = SelectableListUseCase.initializeSelection([
      { id: "WS-1", isSelected: false, label: "One" },
      { id: "WS-2", isSelected: false, label: "Two" },
    ]);

    expect(items[0].isSelected).toBe(true);
    expect(items[1].isSelected).toBe(false);
  });

  it("keeps the current selection when entries are refreshed", () => {
    const items = SelectableListUseCase.syncSelection(
      [
        { id: "WS-1", isSelected: false },
        { id: "WS-2", isSelected: true },
      ],
      [
        { id: "WS-1", isSelected: false, name: "One" },
        { id: "WS-2", isSelected: false, name: "Two" },
      ],
      "WS-1",
    );

    expect(items[1].isSelected).toBe(true);
  });

  it("moves the selection with fallback navigation", () => {
    const items = SelectableListUseCase.selectNext(
      [
        { id: "WS-1", isSelected: true },
        { id: "WS-2", isSelected: false },
        { id: "WS-3", isSelected: false },
      ],
      "down",
    );

    expect(items[1].isSelected).toBe(true);
  });

  it("uses explicit navigation targets when provided", () => {
    const items = SelectableListUseCase.selectNext(
      [
        { id: "WS-1", isSelected: true },
        { id: "WS-2", isSelected: false },
        { id: "WS-3", isSelected: false },
      ],
      "right",
      () => "WS-3",
    );

    expect(items[2].isSelected).toBe(true);
  });
});
