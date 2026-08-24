import type { DatabaseAccessContract, DatabaseStatementContract } from "@cogno/core-api";
import type { WorkspaceConfiguration } from "@cogno/shared/domain/workspace";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceRepository } from "./workspace.repository";

describe("WorkspaceRepository", () => {
  let workspaceRepository: WorkspaceRepository;
  let executeMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let batchMock: ReturnType<typeof vi.fn>;

  function batchedStatements(): DatabaseStatementContract[] {
    return batchMock.mock.calls[0][0] as DatabaseStatementContract[];
  }

  beforeEach(() => {
    executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    selectMock = vi.fn().mockResolvedValue([]);
    batchMock = vi.fn().mockResolvedValue([]);

    const databaseAccess: DatabaseAccessContract = {
      execute: executeMock,
      select: selectMock,
      batch: batchMock,
    };

    workspaceRepository = new WorkspaceRepository(databaseAccess);
  });

  it("loads workspaces with tabs and grids in three queries", async () => {
    selectMock
      .mockResolvedValueOnce([
        { id: "ws1", name: "Workspace 1", color: "blue", position: 0 },
        { id: "ws2", name: "Workspace 2", color: null, position: 1 },
      ])
      .mockResolvedValueOnce([
        {
          workspace_id: "ws1",
          tab_id: "TB-1",
          is_active: 1,
          color: "blue",
          system_title: "C:\\repo",
          user_title: "Tab 1",
        },
        {
          workspace_id: "ws2",
          tab_id: "TB-2",
          is_active: 0,
          color: null,
          system_title: null,
          user_title: null,
        },
      ])
      .mockResolvedValueOnce([
        { workspace_id: "ws1", tab_id: "TB-1", pane_json: JSON.stringify({ terminalId: "TE-1" }) },
        { workspace_id: "ws2", tab_id: "TB-2", pane_json: "not json" },
      ]);

    const workspaces = await workspaceRepository.getAllWorkspaces();

    expect(selectMock).toHaveBeenCalledTimes(3);
    expect(workspaces).toHaveLength(2);
    expect(workspaces[0]).toMatchObject({
      id: "ws1",
      color: "blue",
      position: 0,
      tabs: [{ tabId: "TB-1", isActive: true, systemTitle: "C:\\repo", userTitle: "Tab 1" }],
      grids: [{ tabId: "TB-1", pane: { terminalId: "TE-1" } }],
    });
    expect(workspaces[1].color).toBeUndefined();
    expect(workspaces[1].tabs[0]).toMatchObject({ isActive: false, systemTitle: "Shell" });
    expect(workspaces[1].grids[0].pane).toEqual({});
  });

  it("creates a workspace with its layout in one batch", async () => {
    const workspaceConfiguration: WorkspaceConfiguration = {
      id: "ws1",
      name: "Workspace 1",
      color: "green",
      tabs: [
        {
          tabId: "TB-1",
          isActive: true,
          systemTitle: "C:\\repo",
          userTitle: "Tab 1",
          color: "green",
        },
        { tabId: "TB-2" },
      ],
      grids: [{ tabId: "TB-1", pane: { terminalId: "TE-1" } }],
    };

    await workspaceRepository.createWorkspace(workspaceConfiguration);

    const statements = batchedStatements();
    expect(statements).toHaveLength(4);
    expect(statements[0].sql).toContain("INSERT INTO workspace (");
    expect(statements[0].sql).toContain("SELECT COALESCE(MAX(position) + 1, 0) FROM workspace");
    expect(statements[0].params).toEqual([
      "ws1",
      "Workspace 1",
      "green",
      null,
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(statements[1].params).toEqual(["ws1", "TB-1", 1, "green", "C:\\repo", "Tab 1", 0]);
    expect(statements[2].params).toEqual(["ws1", "TB-2", 0, null, null, null, 1]);
    expect(statements[3].sql).toContain("INSERT INTO workspace_grid");
    expect(statements[3].params).toEqual(["ws1", "TB-1", JSON.stringify({ terminalId: "TE-1" })]);
  });

  it("updates metadata and replaces the layout in one batch", async () => {
    const workspaceConfiguration: WorkspaceConfiguration = {
      id: "ws1",
      name: "Updated",
      color: "red",
      position: 4,
      tabs: [{ tabId: "TB-2", isActive: true, systemTitle: "Tab 2", color: "red" }],
      grids: [{ tabId: "TB-2", pane: { terminalId: "TE-2" } }],
    };

    await workspaceRepository.updateWorkspace(workspaceConfiguration);

    const statements = batchedStatements();
    expect(statements[0].sql).toContain("UPDATE workspace SET name = ?");
    expect(statements[0].params).toEqual(["Updated", "red", 4, expect.any(Number), "ws1"]);
    expect(statements[1]).toEqual({
      sql: "DELETE FROM workspace_tab WHERE workspace_id = ?",
      params: ["ws1"],
    });
    expect(statements[2].sql).toContain("INSERT INTO workspace_tab");
    expect(statements[3].sql).toContain("INSERT INTO workspace_grid");
  });

  it("reorders workspaces by list position in one batch", async () => {
    await workspaceRepository.reorderWorkspaces(["ws2", "ws1"]);

    const statements = batchedStatements();
    expect(statements.map((s) => s.params)).toEqual([
      [0, expect.any(Number), "ws2"],
      [1, expect.any(Number), "ws1"],
    ]);
  });

  it("deletes a workspace by id", async () => {
    await workspaceRepository.deleteWorkspace("ws1");
    expect(executeMock).toHaveBeenCalledWith("DELETE FROM workspace WHERE id = ?", ["ws1"]);
  });

  it("upserts terminal sessions and reads them back with an ISO timestamp", async () => {
    await workspaceRepository.createTerminalSession("ws1", {
      terminalId: "TE-1",
      sessionData: "state",
    });
    await workspaceRepository.updateTerminalSession("ws1", {
      terminalId: "TE-1",
      sessionData: "state2",
    });

    expect(executeMock).toHaveBeenCalledTimes(2);
    for (const [sql] of executeMock.mock.calls) {
      expect(sql).toContain("ON CONFLICT (workspace_id, terminal_id) DO UPDATE");
    }

    selectMock.mockResolvedValueOnce([
      { terminal_id: "TE-1", session_data: "state2", updated_at: Date.UTC(2026, 0, 2) },
    ]);
    await expect(workspaceRepository.getTerminalSessions("ws1")).resolves.toEqual([
      { terminalId: "TE-1", sessionData: "state2", updatedAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });
});
