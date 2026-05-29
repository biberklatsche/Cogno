PRAGMA foreign_keys = ON;

-- Remove unconfirmed patterns that will never surface in autocomplete.
-- Cascade via FK delete on slot stats and slot value stats.
DELETE FROM command_pattern_slot_value_stat
WHERE (context_id, signature_key) IN (
    SELECT context_id, signature_key FROM command_pattern_stat WHERE selected_count = 0
);

DELETE FROM command_pattern_slot_stat
WHERE (context_id, signature_key) IN (
    SELECT context_id, signature_key FROM command_pattern_stat WHERE selected_count = 0
);

DELETE FROM command_pattern_stat WHERE selected_count = 0;

-- Drop columns that are no longer used after removing the shown-count feedback loop.
ALTER TABLE command_pattern_stat DROP COLUMN shown_count;
ALTER TABLE command_pattern_stat DROP COLUMN last_shown_at;
