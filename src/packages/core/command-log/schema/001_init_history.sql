-- Command and directory history.
--
-- Conventions (shared by every schema in this database):
--   * every timestamp is INTEGER milliseconds since the Unix epoch;
--   * rows are deleted, never flagged — there is no deleted_at anywhere;
--   * a value that can be computed from other rows is not stored twice.

------------------------------------------------------------------------------
-- Shell contexts
--
-- A context is the combination that decides how paths and commands are
-- normalised. '' rather than NULL for the WSL distro so the UNIQUE
-- constraint actually holds.
------------------------------------------------------------------------------
CREATE TABLE shell_context (
    id          INTEGER PRIMARY KEY,
    backend_os  TEXT    NOT NULL,
    shell_type  TEXT    NOT NULL,
    wsl_distro  TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    UNIQUE (backend_os, shell_type, wsl_distro)
);

------------------------------------------------------------------------------
-- Paths
------------------------------------------------------------------------------
CREATE TABLE path (
    id          INTEGER PRIMARY KEY,
    path        TEXT    NOT NULL UNIQUE,
    parent_id   INTEGER REFERENCES path (id),
    basename    TEXT    NOT NULL,
    depth       INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);

CREATE INDEX idx_path_parent ON path (parent_id);

CREATE TABLE dir_stat (
    context_id      INTEGER NOT NULL REFERENCES shell_context (id),
    path_id         INTEGER NOT NULL REFERENCES path (id),
    visit_count     INTEGER NOT NULL DEFAULT 0,
    last_visit_at   INTEGER NOT NULL,
    select_count    INTEGER NOT NULL DEFAULT 0,
    last_select_at  INTEGER,
    PRIMARY KEY (context_id, path_id)
);

CREATE INDEX idx_dir_stat_recent ON dir_stat (context_id, last_visit_at DESC);

------------------------------------------------------------------------------
-- Commands
------------------------------------------------------------------------------
CREATE TABLE command (
    id            INTEGER PRIMARY KEY,
    command_text  TEXT    NOT NULL UNIQUE,
    created_at    INTEGER NOT NULL
);

-- Trigram tokenizer: the only FTS5 tokenizer that can serve "fragment
-- anywhere in the command" lookups from the index instead of a table scan.
CREATE VIRTUAL TABLE command_fts USING fts5 (
    command_text,
    content = 'command',
    content_rowid = 'id',
    tokenize = 'trigram'
);

CREATE TRIGGER command_fts_insert AFTER INSERT ON command
BEGIN
    INSERT INTO command_fts (rowid, command_text) VALUES (new.id, new.command_text);
END;

CREATE TRIGGER command_fts_delete AFTER DELETE ON command
BEGIN
    INSERT INTO command_fts (command_fts, rowid, command_text)
    VALUES ('delete', old.id, old.command_text);
END;

CREATE TRIGGER command_fts_update AFTER UPDATE OF command_text ON command
BEGIN
    INSERT INTO command_fts (command_fts, rowid, command_text)
    VALUES ('delete', old.id, old.command_text);
    INSERT INTO command_fts (rowid, command_text) VALUES (new.id, new.command_text);
END;

-- One row per execution. Trimmed to the configured history size.
CREATE TABLE command_log (
    id            INTEGER PRIMARY KEY,
    context_id    INTEGER NOT NULL REFERENCES shell_context (id),
    session_id    TEXT,
    cwd_path_id   INTEGER NOT NULL REFERENCES path (id),
    command_id    INTEGER NOT NULL REFERENCES command (id),
    executed_at   INTEGER NOT NULL,
    duration_ms   INTEGER,
    return_code   INTEGER
);

CREATE INDEX idx_command_log_global  ON command_log (context_id, executed_at DESC);
CREATE INDEX idx_command_log_cwd     ON command_log (context_id, cwd_path_id, executed_at DESC);
CREATE INDEX idx_command_log_session ON command_log (context_id, session_id, executed_at DESC);
CREATE INDEX idx_command_log_command ON command_log (command_id);

-- Ranking aggregate per (context, cwd, command). Kept alongside the log
-- because it outlives log trimming and carries the selection feedback that
-- the log cannot express. Always written in the same batch as the log.
CREATE TABLE command_stat (
    context_id      INTEGER NOT NULL REFERENCES shell_context (id),
    cwd_path_id     INTEGER NOT NULL REFERENCES path (id),
    command_id      INTEGER NOT NULL REFERENCES command (id),
    exec_count      INTEGER NOT NULL DEFAULT 0,
    last_exec_at    INTEGER,
    select_count    INTEGER NOT NULL DEFAULT 0,
    last_select_at  INTEGER,
    PRIMARY KEY (context_id, cwd_path_id, command_id)
);

CREATE INDEX idx_command_stat_command ON command_stat (context_id, command_id);
CREATE INDEX idx_command_stat_cwd_recent ON command_stat (context_id, cwd_path_id, last_exec_at DESC);

-- "After A, the user ran B" — feeds the next-command suggestion. The
-- outgoing total per A is SUM(transition_count) over this table.
CREATE TABLE command_transition_stat (
    context_id           INTEGER NOT NULL REFERENCES shell_context (id),
    previous_command_id  INTEGER NOT NULL REFERENCES command (id),
    next_command_id      INTEGER NOT NULL REFERENCES command (id),
    transition_count     INTEGER NOT NULL DEFAULT 0,
    last_transition_at   INTEGER NOT NULL,
    PRIMARY KEY (context_id, previous_command_id, next_command_id)
);

CREATE INDEX idx_command_transition_previous
    ON command_transition_stat (context_id, previous_command_id, transition_count DESC);

------------------------------------------------------------------------------
-- Command patterns
--
-- A pattern is a command with its variable tokens replaced by slots
-- ("git checkout <slot>"). Per-slot statistics are derived from the value
-- table with GROUP BY; they are not stored.
------------------------------------------------------------------------------
CREATE TABLE command_pattern (
    context_id                     INTEGER NOT NULL REFERENCES shell_context (id),
    signature_key                  TEXT    NOT NULL,
    signature_parts_json           TEXT    NOT NULL,
    pattern_text                   TEXT    NOT NULL,
    stable_token_count             INTEGER NOT NULL,
    non_option_stable_token_count  INTEGER NOT NULL,
    variable_slot_count            INTEGER NOT NULL,
    total_count                    INTEGER NOT NULL DEFAULT 0,
    last_seen_at                   INTEGER NOT NULL,
    selected_count                 INTEGER NOT NULL DEFAULT 0,
    last_selected_at               INTEGER,
    created_at                     INTEGER NOT NULL,
    PRIMARY KEY (context_id, signature_key)
);

CREATE INDEX idx_command_pattern_recent
    ON command_pattern (context_id, total_count DESC, last_seen_at DESC);

CREATE TABLE command_pattern_slot_value (
    context_id     INTEGER NOT NULL,
    signature_key  TEXT    NOT NULL,
    slot_index     INTEGER NOT NULL,
    slot_value     TEXT    NOT NULL,
    value_count    INTEGER NOT NULL DEFAULT 0,
    last_seen_at   INTEGER NOT NULL,
    PRIMARY KEY (context_id, signature_key, slot_index, slot_value),
    FOREIGN KEY (context_id, signature_key)
        REFERENCES command_pattern (context_id, signature_key) ON DELETE CASCADE
);
