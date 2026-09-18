import { Injectable } from "@angular/core";
import { DatabaseAccess, DatabaseStatementContract } from "@cogno/platform";
import {
  PersistedGridConfigurationContract,
  PersistedPaneConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "@cogno/shared/domain";
import { WorkspaceConfiguration, WorkspaceTerminalSession } from "@cogno/shared/domain/workspace";

interface WorkspaceEntity {
  id: string;
  name: string;
  color: string | null;
  position: number;
  is_open: number;
  is_active: number;
}

interface WorkspaceTabEntity {
  workspace_id: string;
  tab_id: string;
  is_active: number;
  color: string | null;
  system_title: string | null;
  user_title: string | null;
}

interface WorkspaceGridEntity {
  workspace_id: string;
  tab_id: string;
  pane_json: string;
}

interface WorkspaceTerminalSessionEntity {
  terminal_id: string;
  session_data: string;
  updated_at: number;
}

/** Appends after the last workspace when no position is given. */
const NEXT_POSITION_SQL = "COALESCE(?, (SELECT COALESCE(MAX(position) + 1, 0) FROM workspace))";

@Injectable({ providedIn: "root" })
export class WorkspaceRepository {
  constructor(private readonly databaseAccess: DatabaseAccess) {}

  async getAllWorkspaces(): Promise<WorkspaceConfiguration[]> {
    const [workspaces, tabs, grids] = await Promise.all([
      this.databaseAccess.select<WorkspaceEntity[]>(
        "SELECT id, name, color, position, is_open, is_active FROM workspace ORDER BY position, created_at, id",
      ),
      this.databaseAccess.select<WorkspaceTabEntity[]>(
        "SELECT workspace_id, tab_id, is_active, color, system_title, user_title FROM workspace_tab ORDER BY workspace_id, position",
      ),
      this.databaseAccess.select<WorkspaceGridEntity[]>(
        "SELECT workspace_id, tab_id, pane_json FROM workspace_grid",
      ),
    ]);

    return workspaces.map((workspaceEntity) => ({
      id: workspaceEntity.id,
      name: workspaceEntity.name,
      color: workspaceEntity.color ?? undefined,
      position: workspaceEntity.position,
      isOpen: workspaceEntity.is_open === 1,
      isActive: workspaceEntity.is_active === 1,
      tabs: tabs
        .filter((tabEntity) => tabEntity.workspace_id === workspaceEntity.id)
        .map((tabEntity) => ({
          tabId: tabEntity.tab_id,
          isActive: tabEntity.is_active === 1,
          color: tabEntity.color ?? undefined,
          systemTitle: tabEntity.system_title ?? "Shell",
          userTitle: tabEntity.user_title ?? undefined,
        })),
      grids: grids
        .filter((gridEntity) => gridEntity.workspace_id === workspaceEntity.id)
        .map((gridEntity) => ({
          tabId: gridEntity.tab_id,
          pane: this.parsePaneJson(gridEntity.pane_json),
        })),
    }));
  }

  async createWorkspace(workspaceConfiguration: WorkspaceConfiguration): Promise<void> {
    const now = Date.now();
    await this.databaseAccess.batch([
      {
        sql: `INSERT INTO workspace (id, name, color, position, created_at, updated_at)
              VALUES (?, ?, ?, ${NEXT_POSITION_SQL}, ?, ?)`,
        params: [
          workspaceConfiguration.id,
          workspaceConfiguration.name,
          workspaceConfiguration.color ?? null,
          workspaceConfiguration.position ?? null,
          now,
          now,
        ],
      },
      ...this.layoutStatements(workspaceConfiguration),
    ]);
  }

  /**
   * Create the workspace row if missing, else update it (name/colour), and
   * replace its layout - one transaction. Used by the autosave path, which must
   * also persist the default workspace (no row on first launch). Position is set
   * only on insert.
   */
  async upsertWorkspace(workspaceConfiguration: WorkspaceConfiguration): Promise<void> {
    const now = Date.now();
    await this.databaseAccess.batch([
      {
        sql: `INSERT INTO workspace (id, name, color, position, created_at, updated_at)
              VALUES (?, ?, ?, ${NEXT_POSITION_SQL}, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                  name = excluded.name,
                  color = excluded.color,
                  updated_at = excluded.updated_at`,
        params: [
          workspaceConfiguration.id,
          workspaceConfiguration.name,
          workspaceConfiguration.color ?? null,
          workspaceConfiguration.position ?? null,
          now,
          now,
        ],
      },
      {
        sql: "DELETE FROM workspace_tab WHERE workspace_id = ?",
        params: [workspaceConfiguration.id],
      },
      ...this.layoutStatements(workspaceConfiguration),
    ]);
  }

  /** Replaces name, colour, position, tabs and grids. Sessions are untouched. */
  async updateWorkspace(workspaceConfiguration: WorkspaceConfiguration): Promise<void> {
    await this.databaseAccess.batch([
      {
        sql: `UPDATE workspace SET name = ?, color = ?, position = ${NEXT_POSITION_SQL}, updated_at = ? WHERE id = ?`,
        params: [
          workspaceConfiguration.name,
          workspaceConfiguration.color ?? null,
          workspaceConfiguration.position ?? null,
          Date.now(),
          workspaceConfiguration.id,
        ],
      },
      // Grids cascade from tabs.
      {
        sql: "DELETE FROM workspace_tab WHERE workspace_id = ?",
        params: [workspaceConfiguration.id],
      },
      ...this.layoutStatements(workspaceConfiguration),
    ]);
  }

  /**
   * Record which workspaces are open and which one is active, in one
   * statement so exactly the given ones carry the flags.
   */
  async saveOpenState(
    openWorkspaceIds: ReadonlyArray<WorkspaceIdentifierContract>,
    activeWorkspaceId: WorkspaceIdentifierContract | undefined,
  ): Promise<void> {
    const openPlaceholders = openWorkspaceIds.map(() => "?").join(", ");
    await this.databaseAccess.execute(
      `UPDATE workspace SET is_open = (id IN (${openPlaceholders})), is_active = (id = ?)`,
      [...openWorkspaceIds, activeWorkspaceId ?? ""],
    );
  }

  async deleteWorkspace(workspaceId: WorkspaceIdentifierContract): Promise<void> {
    await this.databaseAccess.execute("DELETE FROM workspace WHERE id = ?", [workspaceId]);
  }

  async reorderWorkspaces(
    workspaceIdsInOrder: ReadonlyArray<WorkspaceIdentifierContract>,
  ): Promise<void> {
    const now = Date.now();
    await this.databaseAccess.batch(
      workspaceIdsInOrder.map((workspaceId, position) => ({
        sql: "UPDATE workspace SET position = ?, updated_at = ? WHERE id = ?",
        params: [position, now, workspaceId],
      })),
    );
  }

  /**
   * Replace all of a workspace's terminal snapshots in one transaction (session
   * restore, step 27): the current set is deleted and the given sessions
   * inserted, so terminals that went away are pruned. Statements are built up
   * front - no await inside the batch.
   */
  async saveTerminalSessions(
    workspaceId: WorkspaceIdentifierContract,
    sessions: ReadonlyArray<WorkspaceTerminalSession>,
  ): Promise<void> {
    const now = Date.now();
    await this.databaseAccess.batch([
      { sql: "DELETE FROM terminal_session WHERE workspace_id = ?", params: [workspaceId] },
      ...sessions.map((session) => ({
        sql: `INSERT INTO terminal_session (workspace_id, terminal_id, session_data, updated_at)
              VALUES (?, ?, ?, ?)`,
        params: [workspaceId, session.terminalId, session.sessionData, now],
      })),
    ]);
  }

  /** Drop one terminal's snapshot, e.g. when the terminal id was reassigned on repair. */
  async deleteTerminalSession(
    workspaceId: WorkspaceIdentifierContract,
    terminalId: string,
  ): Promise<void> {
    await this.databaseAccess.execute(
      "DELETE FROM terminal_session WHERE workspace_id = ? AND terminal_id = ?",
      [workspaceId, terminalId],
    );
  }

  async getTerminalSessions(
    workspaceId: WorkspaceIdentifierContract,
  ): Promise<WorkspaceTerminalSession[]> {
    const terminalSessionEntities = await this.databaseAccess.select<
      WorkspaceTerminalSessionEntity[]
    >(
      "SELECT terminal_id, session_data, updated_at FROM terminal_session WHERE workspace_id = ? ORDER BY terminal_id",
      [workspaceId],
    );

    return terminalSessionEntities.map((terminalSessionEntity) => ({
      terminalId: terminalSessionEntity.terminal_id,
      sessionData: terminalSessionEntity.session_data,
      updatedAt: new Date(terminalSessionEntity.updated_at).toISOString(),
    }));
  }

  private layoutStatements(
    workspaceConfiguration: WorkspaceConfiguration,
  ): DatabaseStatementContract[] {
    return [
      ...workspaceConfiguration.tabs.map((tabConfiguration, position) =>
        this.insertTabStatement(workspaceConfiguration.id, tabConfiguration, position),
      ),
      ...workspaceConfiguration.grids.map((gridConfiguration) =>
        this.insertGridStatement(workspaceConfiguration.id, gridConfiguration),
      ),
    ];
  }

  private insertTabStatement(
    workspaceId: WorkspaceIdentifierContract,
    tabConfiguration: PersistedTabConfigurationContract,
    position: number,
  ): DatabaseStatementContract {
    return {
      sql: "INSERT INTO workspace_tab (workspace_id, tab_id, is_active, color, system_title, user_title, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      params: [
        workspaceId,
        tabConfiguration.tabId,
        tabConfiguration.isActive ? 1 : 0,
        tabConfiguration.color ?? null,
        tabConfiguration.systemTitle ?? null,
        tabConfiguration.userTitle ?? null,
        position,
      ],
    };
  }

  private insertGridStatement(
    workspaceId: WorkspaceIdentifierContract,
    gridConfiguration: PersistedGridConfigurationContract,
  ): DatabaseStatementContract {
    return {
      sql: "INSERT INTO workspace_grid (workspace_id, tab_id, pane_json) VALUES (?, ?, ?)",
      params: [workspaceId, gridConfiguration.tabId, JSON.stringify(gridConfiguration.pane)],
    };
  }

  private parsePaneJson(paneJson: string): PersistedPaneConfigurationContract {
    try {
      return JSON.parse(paneJson) as PersistedPaneConfigurationContract;
    } catch {
      return {} as PersistedPaneConfigurationContract;
    }
  }
}
