import { describe, expect, it } from "vitest";
import { WorkspaceSelectionUseCase } from "./workspace-selection.use-case";

describe("WorkspaceSelectionUseCase", () => {
  it("initializes selection when none exists", () => {
    const workspaceEntries = WorkspaceSelectionUseCase.initializeSelection([
      { id: "WS-DEFAULT", name: "Default", isSelected: false },
      { id: "WS-1", name: "One", isSelected: false },
    ]);

    expect(workspaceEntries[0].isSelected).toBe(true);
    expect(workspaceEntries[1].isSelected).toBe(false);
  });

  it("keeps the current selection when entries are refreshed", () => {
    const workspaceEntries = WorkspaceSelectionUseCase.updateWorkspaceEntries(
      [
        { id: "WS-DEFAULT", name: "Default", isSelected: false },
        { id: "WS-1", name: "One", isSelected: true },
      ],
      [
        { id: "WS-DEFAULT", name: "Default", isActive: false },
        { id: "WS-1", name: "One", isActive: false },
      ],
    );

    expect(workspaceEntries[1].isSelected).toBe(true);
  });

  it("selects the next workspace using geometry when available", () => {
    const workspaceEntries = WorkspaceSelectionUseCase.selectNext(
      [
        { id: "WS-DEFAULT", name: "Default", isSelected: true },
        { id: "WS-1", name: "One", isSelected: false },
      ],
      "right",
      (activeWorkspaceId, direction) => {
        expect(activeWorkspaceId).toBe("WS-DEFAULT");
        expect(direction).toBe("right");
        return "WS-1";
      },
    );

    expect(workspaceEntries[1].isSelected).toBe(true);
  });

  it("wraps when no navigation target is available", () => {
    const workspaceEntries = WorkspaceSelectionUseCase.selectNext(
      [
        { id: "WS-DEFAULT", name: "Default", isSelected: true },
        { id: "WS-1", name: "One", isSelected: false },
      ],
      "left",
    );

    expect(workspaceEntries[1].isSelected).toBe(true);
  });
});
