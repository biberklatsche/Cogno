ALTER TABLE workspaces
    ADD COLUMN position INTEGER;

WITH ordered_workspaces AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS workspace_position
    FROM workspaces
)
UPDATE workspaces
SET position = (
    SELECT ordered_workspaces.workspace_position
    FROM ordered_workspaces
    WHERE ordered_workspaces.id = workspaces.id
);
