CREATE TABLE workspaces (
                            id TEXT PRIMARY KEY,
                            name TEXT,
                            color TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace_tabs (
                                workspace_id TEXT NOT NULL,
                                tab_id TEXT NOT NULL,
                                is_active INTEGER DEFAULT 0,
                                color TEXT,
                                title TEXT,
                                position INTEGER,
                                PRIMARY KEY (workspace_id, tab_id),
                                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_one_active_tab
    ON workspace_tabs(workspace_id)
    WHERE is_active = 1;

CREATE TABLE workspace_grids (
                                 workspace_id TEXT NOT NULL,
                                 tab_id TEXT NOT NULL,
                                 pane_json TEXT NOT NULL,
                                 PRIMARY KEY (workspace_id, tab_id),
                                 FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                                 FOREIGN KEY (workspace_id, tab_id)
                                     REFERENCES workspace_tabs(workspace_id, tab_id)
                                     ON DELETE CASCADE
);

CREATE UNIQUE INDEX ux_one_grid_per_tab
    ON workspace_grids(workspace_id, tab_id);

CREATE TABLE terminal_sessions (
                                   workspace_id TEXT NOT NULL,
                                   terminal_id TEXT NOT NULL,
                                   session_data TEXT NOT NULL,
                                   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                   PRIMARY KEY (workspace_id, terminal_id)
);
