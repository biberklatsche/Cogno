import { Inject, Injectable } from "@angular/core";
import {
  DatabaseAccessContract,
  PersistedGridConfigurationContract,
  PersistedPaneConfigurationContract,
  PersistedTabConfigurationContract,
  WorkspaceIdentifierContract,
} from "@cogno/core-api";
import { WorkspaceConfiguration, WorkspaceTerminalSession } from "@cogno/core-domain/workspace";
import { databaseAccessToken } from "./app-host.tokens";

export interface WorkspaceEntity {
  id: string;
  name: string;
  color: string;
  autosave: number;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkspaceTabEntity {
  workspace_id: string;
  tab_id: string;
  is_active: number;
  is_title_locked?: number;
  color?: string;
  title?: string;
  position?: number;
}

export interface WorkspaceGridEntity {
  workspace_id: string;
  tab_id: string;
  pane_json: string;
}

export interface WorkspaceTerminalSessionEntity {
  workspace_id: string;
  terminal_id: string;
  session_data: string;
  updated_at?: string;
}

@Injectable({ providedIn: "root" })
export class WorkspaceRepository {
  constructor(
    @Inject(databaseAccessToken)
    private readonly databaseAccess: DatabaseAccessContract,
  ) {}

  async getAllWorkspaces(): Promise<WorkspaceConfiguration[]> {
    const workspaces = await this.databaseAccess.select<WorkspaceEntity[]>(
      "SELECT * FROM workspaces ORDER BY COALESCE(position, 2147483647), created_at, id",
    );
    const result: WorkspaceConfiguration[] = [];

    for (const workspaceEntity of workspaces) {
      const tabEntities = await this.databaseAccess.select<WorkspaceTabEntity[]>(
        "SELECT * FROM workspace_tabs WHERE workspace_id = ? ORDER BY position",
        [workspaceEntity.id],
      );
      const gridEntities = await this.databaseAccess.select<WorkspaceGridEntity[]>(
        "SELECT * FROM workspace_grids WHERE workspace_id = ?",
        [workspaceEntity.id],
      );

      result.push({
        id: workspaceEntity.id,
        name: workspaceEntity.name,
        color: workspaceEntity.color,
        position: workspaceEntity.position,
        autosave: workspaceEntity.autosave === 1,
        tabs: tabEntities.map((tabEntity) => ({
          tabId: tabEntity.tab_id,
          isActive: tabEntity.is_active === 1,
          isTitleLocked: tabEntity.is_title_locked === 1,
          color: tabEntity.color,
          title: tabEntity.title,
        })),
        grids: gridEntities.map((gridEntity) => ({
          tabId: gridEntity.tab_id,
          pane: this.parsePaneJson(gridEntity.pane_json),
        })),
      });
    }

    return result;
  }

  async createWorkspace(workspaceConfiguration: WorkspaceConfiguration): Promise<void> {
    await this.databaseAccess.transaction(async (databaseAccess) => {
      const workspacePosition =
        workspaceConfiguration.position ?? (await this.getNextWorkspacePosition(databaseAccess));
      await databaseAccess.execute(
        "INSERT INTO workspaces (id, name, color, autosave, position) VALUES (?, ?, ?, ?, ?)",
        [
          workspaceConfiguration.id,
          workspaceConfiguration.name,
          workspaceConfiguration.color,
          workspaceConfiguration.autosave ? 1 : 0,
          workspacePosition,
        ],
      );

      let position = 0;
      for (const tabConfiguration of workspaceConfiguration.tabs) {
        await this.insertTab(databaseAccess, workspaceConfiguration.id, tabConfiguration, position);
        position += 1;
      }

      for (const gridConfiguration of workspaceConfiguration.grids) {
        await this.insertGrid(databaseAccess, workspaceConfiguration.id, gridConfiguration);
      }
    });
  }

  async updateWorkspace(workspaceConfiguration: WorkspaceConfiguration): Promise<void> {
    await this.databaseAccess.transaction(async (databaseAccess) => {
      await databaseAccess.execute(
        "UPDATE workspaces SET name = ?, color = ?, autosave = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [
          workspaceConfiguration.name,
          workspaceConfiguration.color,
          workspaceConfiguration.autosave ? 1 : 0,
          workspaceConfiguration.position ?? (await this.getNextWorkspacePosition(databaseAccess)),
          workspaceConfiguration.id,
        ],
      );

      await databaseAccess.execute("DELETE FROM workspace_tabs WHERE workspace_id = ?", [workspaceConfiguration.id]);
      await databaseAccess.execute("DELETE FROM workspace_grids WHERE workspace_id = ?", [workspaceConfiguration.id]);

      let position = 0;
      for (const tabConfiguration of workspaceConfiguration.tabs) {
        await this.insertTab(databaseAccess, workspaceConfiguration.id, tabConfiguration, position);
        position += 1;
      }

      for (const gridConfiguration of workspaceConfiguration.grids) {
        await this.insertGrid(databaseAccess, workspaceConfiguration.id, gridConfiguration);
      }
    });
  }

  async deleteWorkspace(workspaceId: WorkspaceIdentifierContract): Promise<void> {
    await this.databaseAccess.execute("DELETE FROM workspaces WHERE id = ?", [workspaceId]);
  }

  async reorderWorkspaces(workspaceIdsInOrder: ReadonlyArray<WorkspaceIdentifierContract>): Promise<void> {
    await this.databaseAccess.transaction(async (databaseAccess) => {
      let position = 0;
      for (const workspaceId of workspaceIdsInOrder) {
        await databaseAccess.execute(
          "UPDATE workspaces SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [position, workspaceId],
        );
        position += 1;
      }
    });
  }

  async createTerminalSession(
    workspaceId: WorkspaceIdentifierContract,
    workspaceTerminalSession: WorkspaceTerminalSession,
  ): Promise<void> {
    await this.databaseAccess.execute(
      "INSERT INTO terminal_sessions (workspace_id, terminal_id, session_data) VALUES (?, ?, ?)",
      [workspaceId, workspaceTerminalSession.terminalId, workspaceTerminalSession.sessionData],
    );
  }

  async updateTerminalSession(
    workspaceId: WorkspaceIdentifierContract,
    workspaceTerminalSession: WorkspaceTerminalSession,
  ): Promise<void> {
    await this.databaseAccess.execute(
      "UPDATE terminal_sessions SET session_data = ?, updated_at = CURRENT_TIMESTAMP WHERE workspace_id = ? AND terminal_id = ?",
      [workspaceTerminalSession.sessionData, workspaceId, workspaceTerminalSession.terminalId],
    );
  }

  async deleteTerminalSession(
    workspaceId: WorkspaceIdentifierContract,
    terminalId: string,
  ): Promise<void> {
    await this.databaseAccess.execute(
      "DELETE FROM terminal_sessions WHERE workspace_id = ? AND terminal_id = ?",
      [workspaceId, terminalId],
    );
  }

  async getTerminalSessions(workspaceId: WorkspaceIdentifierContract): Promise<WorkspaceTerminalSession[]> {
    const terminalSessionEntities = await this.databaseAccess.select<WorkspaceTerminalSessionEntity[]>(
      "SELECT * FROM terminal_sessions WHERE workspace_id = ?",
      [workspaceId],
    );

    return terminalSessionEntities.map((terminalSessionEntity) => ({
      terminalId: terminalSessionEntity.terminal_id,
      sessionData: terminalSessionEntity.session_data,
      updatedAt: terminalSessionEntity.updated_at,
    }));
  }

  private parsePaneJson(paneJson: string): PersistedPaneConfigurationContract {
    try {
      return JSON.parse(paneJson) as PersistedPaneConfigurationContract;
    } catch {
      return {} as PersistedPaneConfigurationContract;
    }
  }

  private async getNextWorkspacePosition(databaseAccess: DatabaseAccessContract): Promise<number> {
    const [result] = await databaseAccess.select<Array<{ next_position: number | null }>>(
      "SELECT COALESCE(MAX(position) + 1, 0) AS next_position FROM workspaces",
    );
    return result?.next_position ?? 0;
  }

  private async insertTab(
    databaseAccess: DatabaseAccessContract,
    workspaceId: WorkspaceIdentifierContract,
    tabConfiguration: PersistedTabConfigurationContract,
    position: number,
  ): Promise<void> {
    await databaseAccess.execute(
      "INSERT INTO workspace_tabs (workspace_id, tab_id, is_active, is_title_locked, color, title, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        workspaceId,
        tabConfiguration.tabId,
        tabConfiguration.isActive ? 1 : 0,
        tabConfiguration.isTitleLocked ? 1 : 0,
        tabConfiguration.color,
        tabConfiguration.title,
        position,
      ],
    );
  }

  private async insertGrid(
    databaseAccess: DatabaseAccessContract,
    workspaceId: WorkspaceIdentifierContract,
    gridConfiguration: PersistedGridConfigurationContract,
  ): Promise<void> {
    await databaseAccess.execute(
      "INSERT INTO workspace_grids (workspace_id, tab_id, pane_json) VALUES (?, ?, ?)",
      [workspaceId, gridConfiguration.tabId, JSON.stringify(gridConfiguration.pane)],
    );
  }
}
