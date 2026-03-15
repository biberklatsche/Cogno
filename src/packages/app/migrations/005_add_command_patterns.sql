PRAGMA foreign_keys = ON;

CREATE TABLE command_pattern_stat (
    context_id INTEGER NOT NULL,
    signature_key TEXT NOT NULL,
    signature_parts_json TEXT NOT NULL,
    pattern_text TEXT NOT NULL,
    stable_token_count INTEGER NOT NULL,
    non_option_stable_token_count INTEGER NOT NULL,
    variable_slot_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY (context_id, signature_key),
    FOREIGN KEY (context_id) REFERENCES context(id)
);

CREATE INDEX idx_command_pattern_stat_recent
    ON command_pattern_stat(context_id, total_count DESC, last_seen_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE command_pattern_slot_stat (
    context_id INTEGER NOT NULL,
    signature_key TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    distinct_value_count INTEGER NOT NULL DEFAULT 0,
    top_value TEXT NOT NULL,
    top_value_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY (context_id, signature_key, slot_index),
    FOREIGN KEY (context_id, signature_key) REFERENCES command_pattern_stat(context_id, signature_key)
);

CREATE TABLE command_pattern_slot_value_stat (
    context_id INTEGER NOT NULL,
    signature_key TEXT NOT NULL,
    slot_index INTEGER NOT NULL,
    slot_value TEXT NOT NULL,
    value_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY (context_id, signature_key, slot_index, slot_value),
    FOREIGN KEY (context_id, signature_key, slot_index)
        REFERENCES command_pattern_slot_stat(context_id, signature_key, slot_index)
);
