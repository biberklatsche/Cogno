import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceRepository } from './workspace.repository';
import { DB } from '../../_tauri/db';
import { WorkspaceConfig } from '../+model/workspace';

vi.mock('../../_tauri/db', () => ({
  DB: {
    select: vi.fn(),
    execute: vi.fn(),
    load: vi.fn(),
    transaction: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  }
}));

describe('WorkspaceRepository', () => {
  let repository: WorkspaceRepository;

  beforeEach(() => {
    repository = new WorkspaceRepository();
    vi.clearAllMocks();
  });

  describe('getAllWorkspaces', () => {
    it('should return all workspaces with their tabs and grids', async () => {
      const mockWorkspaces = [
        { id: 'ws1', name: 'Workspace 1', color: 'blue', autosave: 1 }
      ];
      const mockTabs = [
        { workspace_id: 'ws1', tab_id: 't1', is_active: 1, color: 'blue', title: 'Tab 1', position: 0 }
      ];
      const mockGrids = [
        { workspace_id: 'ws1', tab_id: 't1', pane_json: JSON.stringify({ pane: { type: 'terminal', id: 'term1' } }) }
      ];

      vi.mocked(DB.select)
        .mockResolvedValueOnce(mockWorkspaces)
        .mockResolvedValueOnce(mockTabs)
        .mockResolvedValueOnce(mockGrids);

      const result = await repository.getAllWorkspaces();

      expect(DB.select).toHaveBeenCalledWith('SELECT * FROM workspaces');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ws1');
      expect(result[0].tabs).toHaveLength(1);
      expect(result[0].tabs[0].tabId).toBe('t1');
      expect(result[0].grids).toHaveLength(1);
    });
  });

  describe('createWorkspace', () => {
    it('should insert workspace, tabs and grids in a transaction', async () => {
      const config: WorkspaceConfig = {
        id: 'ws1',
        name: 'Workspace 1',
        color: 'blue',
        autosave: true,
        tabs: [{ tabId: 't1', isActive: true, title: 'Tab 1', color: 'blue' }],
        grids: [{ tabId: 't1', pane: { type: 'terminal', id: 'term1' } as any }]
      };

      await repository.createWorkspace(config);

      expect(DB.transaction).toHaveBeenCalled();
      expect(DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workspaces'),
        ['ws1', 'Workspace 1', 'blue', 1]
      );
    });

    it('should rollback on error', async () => {
      const config: WorkspaceConfig = {
        id: 'ws1',
        name: 'Workspace 1',
        color: 'blue',
        autosave: true,
        tabs: [],
        grids: []
      };

      vi.mocked(DB.transaction).mockImplementation(async (fn: () => Promise<unknown>) => {
        await fn();
      });
      vi.mocked(DB.execute).mockImplementation(async (q) => {
        if ((q as string).includes('INSERT INTO workspaces')) throw new Error('DB Error');
      });

      await expect(repository.createWorkspace(config)).rejects.toThrow('DB Error');
      expect(DB.transaction).toHaveBeenCalled();
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace by id', async () => {
      await repository.deleteWorkspace('ws1');
      expect(DB.execute).toHaveBeenCalledWith('DELETE FROM workspaces WHERE id = ?', ['ws1']);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace and replace tabs/grids', async () => {
      const config: WorkspaceConfig = {
        id: 'ws1',
        name: 'Updated WS',
        color: 'green',
        autosave: false,
        tabs: [{ tabId: 't2', isActive: true, title: 'Tab 2', color: 'green' }],
        grids: []
      };

      await repository.updateWorkspace(config);

      expect(DB.transaction).toHaveBeenCalled();
      expect(DB.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workspaces SET name = ?'),
        ['Updated WS', 'green', 0, 'ws1']
      );
      expect(DB.execute).toHaveBeenCalledWith('DELETE FROM workspace_tabs WHERE workspace_id = ?', ['ws1']);
      expect(DB.execute).toHaveBeenCalledWith('DELETE FROM workspace_grids WHERE workspace_id = ?', ['ws1']);
    });
  });

  describe('Terminal Sessions', () => {
    it('should create terminal session', async () => {
      await repository.createTerminalSession('ws1', { terminalId: 't1', sessionData: 'data' } as any);
      expect(DB.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO terminal_sessions'), ['ws1', 't1', 'data']);
    });

    it('should update terminal session', async () => {
      await repository.updateTerminalSession('ws1', { terminalId: 't1', sessionData: 'new data' } as any);
      expect(DB.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE terminal_sessions SET session_data = ?'), ['new data', 'ws1', 't1']);
    });

    it('should delete terminal session', async () => {
      await repository.deleteTerminalSession('ws1', 't1' as any);
      expect(DB.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM terminal_sessions'), ['ws1', 't1']);
    });

    it('should get terminal sessions', async () => {
      vi.mocked(DB.select).mockResolvedValue([{ workspace_id: 'ws1', terminal_id: 't1', session_data: 'data' }]);
      const result = await repository.getTerminalSessions(123);
      expect(result).toHaveLength(1);
      expect(result[0].terminalId).toBe('t1');
    });
  });
});
