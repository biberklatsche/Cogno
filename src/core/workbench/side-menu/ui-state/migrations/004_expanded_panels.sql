-- Expand belongs to a panel, not to the open panel: a closed panel opens
-- expanded again. One row per expanded panel, keyed like
-- side_menu_state.selected_item_label. The open panel's flag is carried over.
CREATE TABLE side_menu_expanded_panel (
    label TEXT PRIMARY KEY
);
INSERT INTO side_menu_expanded_panel (label)
SELECT selected_item_label FROM side_menu_state
WHERE id = 1 AND is_expanded <> 0 AND selected_item_label IS NOT NULL;
ALTER TABLE side_menu_state DROP COLUMN is_expanded;
