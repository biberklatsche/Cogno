-- One-time import of the generation-1 history tables, attached as `legacy`.
--
-- The source file may carry broken indexes, so every read is a table scan
-- (NOT INDEXED) and duplicates are collapsed with GROUP BY / OR IGNORE. Ids
-- are preserved so the foreign keys carry over unchanged; every reference
-- is guarded with EXISTS because OR IGNORE does not cover FK violations.

-- context_key was "backendOs=<os>|shell=<shell>" with an optional "|wsl=<distro>".
INSERT OR IGNORE INTO shell_context (id, backend_os, shell_type, wsl_distro, created_at)
SELECT
    id,
    substr(context_key, 11, instr(context_key, '|shell=') - 11),
    CASE
        WHEN instr(context_key, '|wsl=') > 0
            THEN substr(context_key, instr(context_key, '|shell=') + 7,
                        instr(context_key, '|wsl=') - instr(context_key, '|shell=') - 7)
        ELSE substr(context_key, instr(context_key, '|shell=') + 7)
    END,
    CASE
        WHEN instr(context_key, '|wsl=') > 0 THEN substr(context_key, instr(context_key, '|wsl=') + 5)
        ELSE ''
    END,
    created_at
FROM legacy.context NOT INDEXED
WHERE context_key LIKE 'backendOs=%|shell=%';

INSERT OR IGNORE INTO path (id, path, parent_id, basename, depth, created_at)
SELECT id, path, parent_id, basename, depth, created_at
FROM legacy.path NOT INDEXED;

-- A parent that did not make it across must not block the child.
UPDATE path SET parent_id = NULL
WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM path);

INSERT OR IGNORE INTO command (id, command_text, created_at)
SELECT id, command_text, created_at
FROM legacy.command NOT INDEXED;

INSERT OR IGNORE INTO command_log (id, context_id, session_id, cwd_path_id, command_id, executed_at)
SELECT l.id, l.context_id, l.group_id, l.cwd_path_id, l.command_id, l.executed_at
FROM legacy.command_log AS l NOT INDEXED
WHERE EXISTS (SELECT 1 FROM shell_context c WHERE c.id = l.context_id)
  AND EXISTS (SELECT 1 FROM path p WHERE p.id = l.cwd_path_id)
  AND EXISTS (SELECT 1 FROM command m WHERE m.id = l.command_id);

INSERT OR IGNORE INTO command_stat
    (context_id, cwd_path_id, command_id, exec_count, last_exec_at, select_count, last_select_at)
SELECT s.context_id, s.cwd_path_id, s.command_id,
       MAX(s.exec_count), MAX(s.last_exec_at), MAX(s.select_count), MAX(s.last_select_at)
FROM legacy.command_stat AS s NOT INDEXED
WHERE s.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM shell_context c WHERE c.id = s.context_id)
  AND EXISTS (SELECT 1 FROM path p WHERE p.id = s.cwd_path_id)
  AND EXISTS (SELECT 1 FROM command m WHERE m.id = s.command_id)
GROUP BY s.context_id, s.cwd_path_id, s.command_id;

INSERT OR IGNORE INTO dir_stat
    (context_id, path_id, visit_count, last_visit_at, select_count, last_select_at)
SELECT d.context_id, d.to_path_id,
       MAX(d.visit_count), MAX(d.last_visit_at), MAX(d.select_count), MAX(d.last_select_at)
FROM legacy.dir_stat AS d NOT INDEXED
WHERE d.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM shell_context c WHERE c.id = d.context_id)
  AND EXISTS (SELECT 1 FROM path p WHERE p.id = d.to_path_id)
GROUP BY d.context_id, d.to_path_id;

INSERT OR IGNORE INTO command_transition_stat
    (context_id, previous_command_id, next_command_id, transition_count, last_transition_at)
SELECT t.context_id, t.previous_command_id, t.next_command_id,
       MAX(t.transition_count), MAX(t.last_transition_at)
FROM legacy.command_transition_stat AS t NOT INDEXED
WHERE t.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM shell_context c WHERE c.id = t.context_id)
  AND EXISTS (SELECT 1 FROM command m WHERE m.id = t.previous_command_id)
  AND EXISTS (SELECT 1 FROM command m WHERE m.id = t.next_command_id)
GROUP BY t.context_id, t.previous_command_id, t.next_command_id;

INSERT OR IGNORE INTO command_pattern (
    context_id, signature_key, signature_parts_json, pattern_text,
    stable_token_count, non_option_stable_token_count, variable_slot_count,
    total_count, last_seen_at, selected_count, last_selected_at, created_at
)
SELECT s.context_id, s.signature_key, s.signature_parts_json, s.pattern_text,
       s.stable_token_count, s.non_option_stable_token_count, s.variable_slot_count,
       s.total_count, s.last_seen_at, s.selected_count, s.last_selected_at, s.created_at
FROM legacy.command_pattern_stat AS s NOT INDEXED
WHERE s.deleted_at IS NULL
  AND s.selected_count > 0
  AND EXISTS (SELECT 1 FROM shell_context c WHERE c.id = s.context_id);

INSERT OR IGNORE INTO command_pattern_slot_value
    (context_id, signature_key, slot_index, slot_value, value_count, last_seen_at)
SELECT v.context_id, v.signature_key, v.slot_index, v.slot_value,
       MAX(v.value_count), MAX(v.last_seen_at)
FROM legacy.command_pattern_slot_value_stat AS v NOT INDEXED
WHERE v.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM command_pattern p
               WHERE p.context_id = v.context_id AND p.signature_key = v.signature_key)
GROUP BY v.context_id, v.signature_key, v.slot_index, v.slot_value;
