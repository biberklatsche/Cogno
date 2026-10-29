import { WorkspaceRepository } from "@cogno/core/workbench/workspace/workspace.repository";
import type { DatabaseAccess, DatabaseStatement } from "@cogno/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceConfiguration } from "./workspace.model";

describe("WorkspaceRepository", () => {
  let workspaceRepository: WorkspaceRepository;
  let executeMock: ReturnType<typeof vi.fn<DatabaseAccess["execute"]>>;
  let selectMock: ReturnType<
    typeof vi.fn<(query: string, parameters?: ReadonlyArray<unknown>) => Promise<unknown>>
  >;
  let batchMock: ReturnType<typeof vi.fn<DatabaseAccess["batch"]>>;

  function batchedStatements(): DatabaseStatement[] {
    return batchMock.mock.calls[0][0] as DatabaseStatement[];
  }

  beforeEach(() => {
    executeMock = vi
      .fn<DatabaseAccess["execute"]>()
      .mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    selectMock = vi
      .fn<(query: string, parameters?: ReadonlyArray<unknown>) => Promise<unknown>>()
      .mockResolvedValue([]);
    batchMock = vi.fn<DatabaseAccess["batch"]>().mockResolvedValue([]);

    const databaseAccess: Pick<DatabaseAccess, "execute" | "select" | "batch"> = {
      execute: executeMock,
      select: selectMock as DatabaseAccess["select"],
      batch: batchMock,
    };

    workspaceRepository = new WorkspaceRepository(databaseAccess as DatabaseAccess);
  });

  it("loads workspaces with tabs and grids in three queries", async () => {
    selectMock
      .mockResolvedValueOnce([
        { id: "ws1", name: "Workspace 1", color: "blue", position: 0, is_open: 1, is_active: 1 },
        { id: "ws2", name: "Workspace 2", color: null, position: 1, is_open: 0, is_active: 0 },
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
      isOpen: true,
      isActive: true,
      tabs: [{ tabId: "TB-1", isActive: true, systemTitle: "C:\\repo", userTitle: "Tab 1" }],
      grids: [{ tabId: "TB-1", pane: { terminalId: "TE-1" } }],
    });
    expect(workspaces[1].color).toBeUndefined();
    expect(workspaces[1]).toMatchObject({ isOpen: false, isActive: false });
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

    await workspaceRepository.upsertWorkspace(workspaceConfiguration);

    const statements = batchedStatements();
    expect(statements).toHaveLength(5);
    expect(statements[0].sql).toContain("INSERT INTO workspace (");
    expect(statements[0].sql).toContain("SELECT COALESCE(MAX(position) + 1, 0) FROM workspace");
    // Without a position a new row is appended and an existing one keeps its place.
    expect(statements[0].sql).toContain("position = COALESCE(?, position)");
    expect(statements[0].params).toEqual([
      "ws1",
      "Workspace 1",
      "green",
      null,
      expect.any(Number),
      expect.any(Number),
      null,
    ]);
    expect(statements[1]).toEqual({
      sql: "DELETE FROM workspace_tab WHERE workspace_id = ?",
      params: ["ws1"],
    });
    expect(statements[2].params).toEqual(["ws1", "TB-1", 1, "green", "C:\\repo", "Tab 1", 0]);
    expect(statements[3].params).toEqual(["ws1", "TB-2", 0, null, null, null, 1]);
    expect(statements[4].sql).toContain("INSERT INTO workspace_grid");
    expect(statements[4].params).toEqual(["ws1", "TB-1", JSON.stringify({ terminalId: "TE-1" })]);
  });

  it("writes the position when given and replaces the layout in one batch", async () => {
    const workspaceConfiguration: WorkspaceConfiguration = {
      id: "ws1",
      name: "Updated",
      color: "red",
      position: 4,
      tabs: [{ tabId: "TB-2", isActive: true, systemTitle: "Tab 2", color: "red" }],
      grids: [{ tabId: "TB-2", pane: { terminalId: "TE-2" } }],
    };

    await workspaceRepository.upsertWorkspace(workspaceConfiguration);

    const statements = batchedStatements();
    expect(statements[0].sql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(statements[0].params).toEqual([
      "ws1",
      "Updated",
      "red",
      4,
      expect.any(Number),
      expect.any(Number),
      4,
    ]);
    expect(statements[1]).toEqual({
      sql: "DELETE FROM workspace_tab WHERE workspace_id = ?",
      params: ["ws1"],
    });
    expect(statements[2].sql).toContain("INSERT INTO workspace_tab");
    expect(statements[3].sql).toContain("INSERT INTO workspace_grid");
  });

  it("records the open workspaces and the active one in one statement", async () => {
    await workspaceRepository.saveOpenState(["ws1", "ws2"], "ws2");

    expect(executeMock).toHaveBeenCalledTimes(1);
    const [sql, params] = executeMock.mock.calls[0];
    expect(sql).toMatch(/UPDATE workspace SET is_open = .*is_active = /s);
    expect(params).toEqual(["ws1", "ws2", "ws2"]);
  });

  it("clears what session restore wrote and keeps the user's workspaces", async () => {
    await workspaceRepository.clearRestoreData("WS-DEFAULT");

    const statements = batchedStatements();
    expect(statements.map((s) => s.sql)).toEqual([
      "DELETE FROM terminal_session",
      "UPDATE workspace SET is_open = 0, is_active = 0",
      "DELETE FROM workspace WHERE id = ?",
    ]);
    // Only the default workspace's row goes; no other workspace is deleted.
    expect(statements[2].params).toEqual(["WS-DEFAULT"]);
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

  it("reads terminal sessions back with an ISO timestamp", async () => {
    selectMock.mockResolvedValueOnce([
      { terminal_id: "TE-1", session_data: "state2", updated_at: Date.UTC(2026, 0, 2) },
    ]);
    await expect(workspaceRepository.getTerminalSessions("ws1")).resolves.toEqual([
      { terminalId: "TE-1", sessionData: "state2", updatedAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });
});
