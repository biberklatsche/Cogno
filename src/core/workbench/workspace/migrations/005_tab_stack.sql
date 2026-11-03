-- Tab stacks: tabs grouped into one place of the tab bar. A stack id is
-- global like a tab id (one stack lives in one workspace), which is what lets
-- workspace_tab point at it with a single column.

CREATE TABLE workspace_tab_stack (
    stack_id        TEXT PRIMARY KEY,
    workspace_id    TEXT NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    name            TEXT,
    color           TEXT,
    -- The member the collapsed stack stands for; one of its tabs.
    current_tab_id  TEXT,
    -- Shown with its members (1) or as its head alone (0).
    is_expanded     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE workspace_tab ADD COLUMN stack_id TEXT REFERENCES workspace_tab_stack (stack_id);
