PRAGMA foreign_keys = ON;

ALTER TABLE command_pattern_stat
    ADD COLUMN shown_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE command_pattern_stat
    ADD COLUMN selected_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE command_pattern_stat
    ADD COLUMN last_shown_at INTEGER NULL;

ALTER TABLE command_pattern_stat
    ADD COLUMN last_selected_at INTEGER NULL;
