-- Which workspaces are open and which one is active survive a restart, so
-- the next launch puts back what the user had in front of them.

ALTER TABLE workspace ADD COLUMN is_open   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspace ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;
