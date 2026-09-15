-- Workspaces: saved tab/pane layouts and the terminal sessions attached to
-- them. Timestamps are INTEGER milliseconds since the Unix epoch.

CREATE TABLE workspace (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    color       TEXT,
    position    INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE workspace_tab (
    workspace_id  TEXT    NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    tab_id        TEXT    NOT NULL,
    is_active     INTEGER NOT NULL DEFAULT 0,
    color         TEXT,
    system_title  TEXT,
    user_title    TEXT,
    position      INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, tab_id)
);

-- At most one active tab per workspace.
CREATE UNIQUE INDEX ux_workspace_tab_active
    ON workspace_tab (workspace_id)
    WHERE is_active = 1;

CREATE TABLE workspace_grid (
    workspace_id  TEXT NOT NULL,
    tab_id        TEXT NOT NULL,
    pane_json     TEXT NOT NULL,
    PRIMARY KEY (workspace_id, tab_id),
    FOREIGN KEY (workspace_id, tab_id)
        REFERENCES workspace_tab (workspace_id, tab_id) ON DELETE CASCADE
);

CREATE TABLE terminal_session (
    workspace_id  TEXT    NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    terminal_id   TEXT    NOT NULL,
    session_data  TEXT    NOT NULL,
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, terminal_id)
);
