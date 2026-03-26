import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseAccessContract } from "@cogno/core-sdk";
import { WorkspaceConfiguration } from "@cogno/features/side-menu/workspace/workspace.model";
import { WorkspaceRepository } from "@cogno/features/side-menu/workspace/workspace.repository";

describe("WorkspaceRepository", () => {
  let workspaceRepository: WorkspaceRepository;
  let executeMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let transactionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    executeMock = vi.fn().mockResolvedValue(undefined);
    selectMock = vi.fn();
    transactionMock = vi.fn(async (handler: (databaseAccess: DatabaseAccessContract) => Promise<unknown>) => handler(databaseAccess));

    const databaseAccess: DatabaseAccessContract = {
      execute: executeMock,
      select: selectMock,
      transaction: transactionMock,
    };

    workspaceRepository = new WorkspaceRepository(databaseAccess);
  });

  it("loads workspaces with tabs and grids", async () => {
    selectMock
      .mockResolvedValueOnce([{ id: "ws1", name: "Workspace 1", color: "blue", autosave: 1, position: 0 }])
      .mockResolvedValueOnce([
        {
          workspace_id: "ws1",
          tab_id: "TB-1",
          is_active: 1,
          is_title_locked: 1,
          color: "blue",
          title: "Tab 1",
          position: 0,
        },
      ])
      .mockResolvedValueOnce([
        { workspace_id: "ws1", tab_id: "TB-1", pane_json: JSON.stringify({ terminalId: "TE-1" }) },
      ]);

    const workspaceConfigurations = await workspaceRepository.getAllWorkspaces();

    expect(workspaceConfigurations).toHaveLength(1);
    expect(workspaceConfigurations[0].id).toBe("ws1");
    expect(workspaceConfigurations[0].position).toBe(0);
    expect(workspaceConfigurations[0].tabs[0].tabId).toBe("TB-1");
    expect(workspaceConfigurations[0].grids[0].tabId).toBe("TB-1");
  });

  it("creates a workspace transactionally", async () => {
    const workspaceConfiguration: WorkspaceConfiguration = {
      id: "ws1",
      name: "Workspace 1",
      color: "green",
      autosave: true,
      position: 0,
      tabs: [{ tabId: "TB-1", isActive: true, isTitleLocked: true, title: "Tab 1", color: "green" }],
      grids: [{ tabId: "TB-1", pane: { terminalId: "TE-1" } }],
    };

    await workspaceRepository.createWorkspace(workspaceConfiguration);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workspaces"),
      ["ws1", "Workspace 1", "green", 1, 0],
    );
  });

  it("updates workspace metadata and layout", async () => {
    const workspaceConfiguration: WorkspaceConfiguration = {
      id: "ws1",
      name: "Updated",
      color: "red",
      autosave: false,
      position: 4,
      tabs: [{ tabId: "TB-2", isActive: true, isTitleLocked: false, title: "Tab 2", color: "red" }],
      grids: [{ tabId: "TB-2", pane: { terminalId: "TE-2" } }],
    };

    await workspaceRepository.updateWorkspace(workspaceConfiguration);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces SET name = ?"),
      ["Updated", "red", 0, 4, "ws1"],
    );
  });

  it("reorders persisted workspaces by position", async () => {
    await workspaceRepository.reorderWorkspaces(["ws2", "ws1"]);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenNthCalledWith(
      1,
      "UPDATE workspaces SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [0, "ws2"],
    );
    expect(executeMock).toHaveBeenNthCalledWith(
      2,
      "UPDATE workspaces SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [1, "ws1"],
    );
  });

  it("deletes workspace by id", async () => {
    await workspaceRepository.deleteWorkspace("ws1");
    expect(executeMock).toHaveBeenCalledWith("DELETE FROM workspaces WHERE id = ?", ["ws1"]);
  });
});
