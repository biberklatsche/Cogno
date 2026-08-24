-- One-time import of the generation-1 workspace tables, attached as `legacy`.
-- Reads are table scans (the source may carry broken indexes) and every
-- reference is guarded with EXISTS. DATETIME text becomes epoch milliseconds.

INSERT OR IGNORE INTO workspace (id, name, color, position, created_at, updated_at)
SELECT
    id,
    COALESCE(name, 'Workspace'),
    color,
    COALESCE(position, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1),
    COALESCE(CAST(strftime('%s', created_at) AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    COALESCE(CAST(strftime('%s', updated_at) AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
FROM legacy.workspaces NOT INDEXED;

INSERT OR IGNORE INTO workspace_tab
    (workspace_id, tab_id, is_active, color, system_title, user_title, position)
SELECT
    t.workspace_id,
    t.tab_id,
    COALESCE(t.is_active, 0),
    t.color,
    COALESCE(t.system_title, t.title),
    t.user_title,
    COALESCE(t.position, ROW_NUMBER() OVER (PARTITION BY t.workspace_id ORDER BY t.position, t.tab_id) - 1)
FROM legacy.workspace_tabs AS t NOT INDEXED
WHERE EXISTS (SELECT 1 FROM workspace w WHERE w.id = t.workspace_id);

INSERT OR IGNORE INTO workspace_grid (workspace_id, tab_id, pane_json)
SELECT g.workspace_id, g.tab_id, g.pane_json
FROM legacy.workspace_grids AS g NOT INDEXED
WHERE EXISTS (SELECT 1 FROM workspace_tab t
               WHERE t.workspace_id = g.workspace_id AND t.tab_id = g.tab_id);

INSERT OR IGNORE INTO terminal_session (workspace_id, terminal_id, session_data, updated_at)
SELECT
    s.workspace_id,
    s.terminal_id,
    s.session_data,
    COALESCE(CAST(strftime('%s', s.updated_at) AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
FROM legacy.terminal_sessions AS s NOT INDEXED
WHERE EXISTS (SELECT 1 FROM workspace w WHERE w.id = s.workspace_id);
