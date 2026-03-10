-- Adds autosave flag to workspaces
ALTER TABLE workspaces
    ADD COLUMN autosave INTEGER DEFAULT 0;
