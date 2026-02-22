-- Adds lock flag for manual tab titles
ALTER TABLE workspace_tabs
    ADD COLUMN is_title_locked INTEGER DEFAULT 0;
