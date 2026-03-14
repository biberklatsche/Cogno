PRAGMA foreign_keys = ON;

CREATE TABLE command_transition_stat (
    context_id INTEGER NOT NULL,
    previous_command_id INTEGER NOT NULL,
    next_command_id INTEGER NOT NULL,
    transition_count INTEGER NOT NULL DEFAULT 0,
    last_transition_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY (context_id, previous_command_id, next_command_id),
    FOREIGN KEY (context_id) REFERENCES context(id),
    FOREIGN KEY (previous_command_id) REFERENCES command(id),
    FOREIGN KEY (next_command_id) REFERENCES command(id)
);

CREATE INDEX idx_command_transition_previous
    ON command_transition_stat(context_id, previous_command_id, transition_count DESC, last_transition_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE command_transition_outgoing_stat (
    context_id INTEGER NOT NULL,
    previous_command_id INTEGER NOT NULL,
    outgoing_count INTEGER NOT NULL DEFAULT 0,
    last_transition_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER NULL,
    PRIMARY KEY (context_id, previous_command_id),
    FOREIGN KEY (context_id) REFERENCES context(id),
    FOREIGN KEY (previous_command_id) REFERENCES command(id)
);

CREATE INDEX idx_command_transition_outgoing_previous
    ON command_transition_outgoing_stat(context_id, previous_command_id, outgoing_count DESC, last_transition_at DESC)
    WHERE deleted_at IS NULL;
