CREATE TABLE command_log (
                             id INTEGER PRIMARY KEY,
                             context_id INTEGER NOT NULL,
                             group_id TEXT NULL,
                             cwd_path_id INTEGER NOT NULL,
                             command_id INTEGER NOT NULL,
                             executed_at INTEGER NOT NULL,
                             FOREIGN KEY(context_id) REFERENCES context(id),
                             FOREIGN KEY(cwd_path_id) REFERENCES path(id),
                             FOREIGN KEY(command_id) REFERENCES command(id)
);

CREATE INDEX idx_command_log_session
    ON command_log(group_id, executed_at DESC);

CREATE INDEX idx_command_log_cwd
    ON command_log(context_id, cwd_path_id, executed_at DESC);

CREATE INDEX idx_command_log_global
    ON command_log(context_id, executed_at DESC);
