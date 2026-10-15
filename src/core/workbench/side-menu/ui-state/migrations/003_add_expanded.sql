-- Whether the open panel spans the whole terminal area, kept like pinning.
ALTER TABLE side_menu_state ADD COLUMN is_expanded INTEGER NOT NULL DEFAULT 0;
