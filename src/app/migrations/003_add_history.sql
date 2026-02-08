PRAGMA foreign_keys = ON;

CREATE TABLE context (
                         id INTEGER PRIMARY KEY,
                         context_key TEXT NOT NULL UNIQUE,
                         created_at INTEGER NOT NULL,
                         deleted_at INTEGER NULL
);

CREATE TABLE path (
                      id INTEGER PRIMARY KEY,
                      path TEXT NOT NULL UNIQUE,
                      path_hash TEXT NOT NULL UNIQUE,
                      parent_id INTEGER NULL,
                      basename TEXT NOT NULL,
                      depth INTEGER NOT NULL,
                      created_at INTEGER NOT NULL,
                      deleted_at INTEGER NULL,
                      FOREIGN KEY(parent_id) REFERENCES path(id)
);

CREATE INDEX idx_path_parent ON path(parent_id);
CREATE INDEX idx_path_basename ON path(basename);

CREATE TABLE directory_edge (
                                parent_id INTEGER NOT NULL,
                                child_id  INTEGER NOT NULL,
                                first_seen_at INTEGER NOT NULL,
                                last_seen_at  INTEGER NOT NULL,
                                seen_count INTEGER NOT NULL DEFAULT 1,
                                deleted_at INTEGER NULL,
                                PRIMARY KEY(parent_id, child_id),
                                FOREIGN KEY(parent_id) REFERENCES path(id),
                                FOREIGN KEY(child_id)  REFERENCES path(id)
);

CREATE INDEX idx_directory_edge_last_seen
    ON directory_edge(last_seen_at)
    WHERE deleted_at IS NULL;

CREATE TABLE command (
                         id INTEGER PRIMARY KEY,
                         command_text TEXT NOT NULL UNIQUE,
                         command_hash TEXT NOT NULL UNIQUE,
                         first_token TEXT NOT NULL,
                         created_at INTEGER NOT NULL,
                         deleted_at INTEGER NULL
);

CREATE INDEX idx_command_first_token
    ON command(first_token)
    WHERE deleted_at IS NULL;

-- FTS5 (nur aktive commands)
CREATE VIRTUAL TABLE command_fts
USING fts5(
  command_text,
  content='command',
  content_rowid='id',
  tokenize='unicode61'
);

-- INSERT → immer rein
CREATE TRIGGER command_ai AFTER INSERT ON command
    WHEN new.deleted_at IS NULL
BEGIN
    INSERT INTO command_fts(rowid, command_text)
    VALUES (new.id, new.command_text);
END;

-- UPDATE: soft delete
CREATE TRIGGER command_soft_delete AFTER UPDATE ON command
    WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL
BEGIN
    INSERT INTO command_fts(command_fts, rowid, command_text)
    VALUES ('delete', old.id, old.command_text);
END;

-- UPDATE: re-activate
CREATE TRIGGER command_restore AFTER UPDATE ON command
    WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL
BEGIN
    INSERT INTO command_fts(rowid, command_text)
    VALUES (new.id, new.command_text);
END;

-- UPDATE: text changed (and active)
CREATE TRIGGER command_update_text AFTER UPDATE ON command
    WHEN old.command_text != new.command_text AND new.deleted_at IS NULL
BEGIN
INSERT INTO command_fts(command_fts, rowid, command_text)
VALUES ('delete', old.id, old.command_text);
INSERT INTO command_fts(rowid, command_text)
VALUES (new.id, new.command_text);
END;

CREATE TABLE command_stat (
                              context_id INTEGER NOT NULL,
                              cwd_path_id INTEGER NOT NULL,
                              command_id INTEGER NOT NULL,

                              exec_count INTEGER NOT NULL DEFAULT 0,
                              last_exec_at INTEGER NULL,

                              select_count INTEGER NOT NULL DEFAULT 0,
                              last_select_at INTEGER NULL,

                              avg_duration_ms REAL NULL,
                              success_count INTEGER NOT NULL DEFAULT 0,
                              last_return_code INTEGER NULL,

                              created_at INTEGER NOT NULL,
                              deleted_at INTEGER NULL,

                              PRIMARY KEY(context_id, cwd_path_id, command_id),
                              FOREIGN KEY(context_id) REFERENCES context(id),
                              FOREIGN KEY(cwd_path_id) REFERENCES path(id),
                              FOREIGN KEY(command_id)  REFERENCES command(id)
);

CREATE INDEX idx_command_stat_exec_recent
    ON command_stat(context_id, cwd_path_id, last_exec_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_command_stat_select_recent
    ON command_stat(context_id, cwd_path_id, last_select_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE dir_stat (
                          context_id INTEGER NOT NULL,
                          to_path_id INTEGER NOT NULL,

                          visit_count INTEGER NOT NULL DEFAULT 0,
                          last_visit_at INTEGER NOT NULL,

                          select_count INTEGER NOT NULL DEFAULT 0,
                          last_select_at INTEGER NULL,

                          created_at INTEGER NOT NULL,
                          deleted_at INTEGER NULL,

                          PRIMARY KEY(context_id, to_path_id),
                          FOREIGN KEY(context_id) REFERENCES context(id),
                          FOREIGN KEY(to_path_id) REFERENCES path(id)
);

CREATE INDEX idx_dir_stat_recent
    ON dir_stat(context_id, last_visit_at DESC)
    WHERE deleted_at IS NULL;
