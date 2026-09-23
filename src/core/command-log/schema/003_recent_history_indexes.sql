-- Match the complete history order, including executions with equal timestamps.
-- These also support the reverse lookup of the adjacent newer execution.
DROP INDEX idx_command_log_global;
CREATE INDEX idx_command_log_global
    ON command_log (context_id, executed_at DESC, id DESC);

DROP INDEX idx_command_log_cwd;
CREATE INDEX idx_command_log_cwd
    ON command_log (context_id, cwd_path_id, executed_at DESC, id DESC);

DROP INDEX idx_command_log_session;
CREATE INDEX idx_command_log_session
    ON command_log (context_id, session_id, executed_at DESC, id DESC);
