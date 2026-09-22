import { defaultWorkspaceIdContract, WorkspaceEntryContract } from "@cogno/shared/domain";
import { describe, expect, it } from "vitest";
import { workspaceBadge } from "./workspace-badge";

const entry = (overrides: Partial<WorkspaceEntryContract> = {}): WorkspaceEntryContract => ({
  id: "WS-1",
  name: "backend",
  color: "blue",
  ...overrides,
});

describe("workspaceBadge", () => {
  it("shows the first letter on the workspace color", () => {
    expect(workspaceBadge(entry(), true)).toEqual({
      letter: "b",
      color: "var(--color-blue)",
      textColor: "var(--background-color)",
      marker: undefined,
    });
  });

  it("falls back to green and a foreground letter for the default workspace", () => {
    const badge = workspaceBadge(
      entry({ id: defaultWorkspaceIdContract, name: "", color: undefined }),
      true,
    );

    expect(badge).toMatchObject({
      letter: "?",
      color: "var(--color-green)",
      textColor: "var(--foreground-color)",
    });
  });

  it("marks the active workspace with a check", () => {
    expect(workspaceBadge(entry({ isActive: true }), true).marker?.icon).toBe("mdiCheck");
  });

  it("puts a failed autosave before the active mark", () => {
    const marker = workspaceBadge(entry({ isActive: true, autoSaveFailed: true }), true).marker;

    expect(marker?.icon).toBe("mdiAlert");
  });

  it("puts unsaved edits before the active mark when restore is off", () => {
    const marker = workspaceBadge(entry({ isActive: true, isDirty: true }), false).marker;

    expect(marker?.icon).toBe("mdiViewDashboardEdit");
  });

  it("ignores dirty state while restore is on and autosave state while it is off", () => {
    expect(workspaceBadge(entry({ isDirty: true }), true).marker).toBeUndefined();
    expect(workspaceBadge(entry({ autoSaveFailed: true }), false).marker).toBeUndefined();
  });
});
