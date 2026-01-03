


import {Injectable} from "@angular/core";
import {DB} from "../../_tauri/db";
import {WorkspaceConfig, TabConfig, GridConfig, TerminalSession, WorkspaceId} from "../+model/workspace";
import {TerminalId} from "../../grid-list/+model/model";

export type WorkspaceEntity = {
    id: string;
    name: string;
    color: string;
    autosave: number; // stored as INTEGER (0/1)
    created_at?: string;
    updated_at?: string;
}

export interface TabEntity {
    workspace_id: string;
    tab_id: string;
    is_active: number;
    color?: string;
    title?: string;
    position?: number;
}

export interface GridEntity {
    workspace_id: string;
    tab_id: string;
    pane_json: string;
}

export interface TerminalSessionEntity {
    workspace_id: string;
    terminal_id: string;
    session_data: string;
    updated_at?: string;
}

@Injectable({providedIn: 'root'})
export class WorkspaceRepository {

    async getAllWorkspaces(): Promise<WorkspaceConfig[]> {
        const workspaces = await DB.select<WorkspaceEntity[]>("SELECT * FROM workspaces");
        const result: WorkspaceConfig[] = [];

        for (const workspace of workspaces) {
            const tabs = await DB.select<TabEntity[]>("SELECT * FROM workspace_tabs WHERE workspace_id = ? ORDER BY position", [workspace.id]);
            const grids = await DB.select<GridEntity[]>("SELECT * FROM workspace_grids WHERE workspace_id = ?", [workspace.id]);

            result.push({
                id: workspace.id,
                name: workspace.name,
                color: workspace.color as any,
                autosave: workspace.autosave === 1,
                tabs: tabs.map(t => ({
                    tabId: t.tab_id,
                    isActive: t.is_active === 1,
                    color: t.color as any,
                    title: t.title
                })),
                grids: grids.map(g => ({
                    tabId: g.tab_id,
                    pane: JSON.parse(g.pane_json)
                }))
            });
        }
        return result;
    }

    async createWorkspace(config: WorkspaceConfig): Promise<void> {
        await DB.execute("BEGIN;");
        try {
            await DB.execute(
                "INSERT INTO workspaces (id, name, color, autosave) VALUES (?, ?, ?, ?)",
                [config.id, config.name, config.color, config.autosave ? 1 : 0]
            );

            let pos = 0;
            for (const tab of config.tabs) {
                await this.insertTab(config.id, tab, pos++);
            }

            for (const grid of config.grids) {
                await this.insertGrid(config.id, grid);
            }

            await DB.execute("COMMIT;");
        } catch (e) {
            await DB.execute("ROLLBACK;");
            throw e;
        }
    }

    async updateWorkspace(config: WorkspaceConfig): Promise<void> {
        await DB.execute("BEGIN;");
        try {
            await DB.execute(
                "UPDATE workspaces SET name = ?, color = ?, autosave = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [config.name, config.color, config.autosave ? 1 : 0, config.id]
            );

            await DB.execute("DELETE FROM workspace_tabs WHERE workspace_id = ?", [config.id]);
            await DB.execute("DELETE FROM workspace_grids WHERE workspace_id = ?", [config.id]);

            let pos = 0;
            for (const tab of config.tabs) {
                await this.insertTab(config.id, tab, pos++);
            }

            for (const grid of config.grids) {
                await this.insertGrid(config.id, grid);
            }

            await DB.execute("COMMIT;");
        } catch (e) {
            await DB.execute("ROLLBACK;");
            throw e;
        }
    }

    async deleteWorkspace(id: string): Promise<void> {
        await DB.execute("DELETE FROM workspaces WHERE id = ?", [id]);
    }

    private async insertTab(workspaceId: WorkspaceId, tab: TabConfig, position?: number): Promise<void> {
        await DB.execute(
            "INSERT INTO workspace_tabs (workspace_id, tab_id, is_active, color, title, position) VALUES (?, ?, ?, ?, ?, ?)",
            [workspaceId, tab.tabId, tab.isActive ? 1 : 0, tab.color, tab.title, position]
        );
    }

    private async insertGrid(workspaceId: WorkspaceId, grid: GridConfig): Promise<void> {
        await DB.execute(
            "INSERT INTO workspace_grids (workspace_id, tab_id, pane_json) VALUES (?, ?, ?)",
            [workspaceId, grid.tabId, JSON.stringify(grid.pane)]
        );
    }

    // Terminal Sessions
    async createTerminalSession(workspaceId: WorkspaceId, session: TerminalSession): Promise<void> {
        await DB.execute(
            'INSERT INTO terminal_sessions (workspace_id, terminal_id, session_data) VALUES (?, ?, ?)',
            [workspaceId, session.terminalId, session.sessionData]
        );
    }

    async updateTerminalSession(workspaceId: WorkspaceId, session: TerminalSession): Promise<void> {
        await DB.execute(
            'UPDATE terminal_sessions SET session_data = ?, updated_at = CURRENT_TIMESTAMP WHERE workspace_id = ? AND terminal_id = ?',
            [session.sessionData, workspaceId, session.terminalId]
        );
    }

    async deleteTerminalSession(workspaceId: WorkspaceId, terminalId: TerminalId): Promise<void> {
        await DB.execute(
            'DELETE FROM terminal_sessions WHERE workspace_id = ? AND terminal_id = ?',
            [workspaceId, terminalId]
        );
    }

    async getTerminalSessions(workspaceId: number): Promise<TerminalSession[]> {
        const rows = await DB.select<TerminalSessionEntity[]>(
            "SELECT * FROM terminal_sessions WHERE workspace_id = ?",
            [workspaceId]
        );
        return rows.map(r => ({
            workspaceId: r.workspace_id,
            terminalId: r.terminal_id,
            sessionData: r.session_data,
            updatedAt: r.updated_at
        }));
    }
}
