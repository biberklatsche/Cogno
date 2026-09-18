-- A terminal id names one session in one workspace. Key terminal_session by
-- the terminal id alone so a snapshot can never be stored under two
-- workspaces. Where older data holds one, the most recently saved row wins.

CREATE TABLE terminal_session_next (
    terminal_id   TEXT    NOT NULL PRIMARY KEY,
    workspace_id  TEXT    NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    session_data  TEXT    NOT NULL,
    updated_at    INTEGER NOT NULL
);

INSERT INTO terminal_session_next (terminal_id, workspace_id, session_data, updated_at)
SELECT terminal_id, workspace_id, session_data, updated_at
FROM (
    SELECT
        terminal_id,
        workspace_id,
        session_data,
        updated_at,
        ROW_NUMBER() OVER (PARTITION BY terminal_id ORDER BY updated_at DESC, workspace_id) AS rank
    FROM terminal_session
)
WHERE rank = 1;

DROP TABLE terminal_session;
ALTER TABLE terminal_session_next RENAME TO terminal_session;

CREATE INDEX ix_terminal_session_workspace ON terminal_session (workspace_id);
