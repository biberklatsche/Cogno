-- One-time import of the generation-1 side menu state, attached as `legacy`.
INSERT OR IGNORE INTO side_menu_state
    (id, selected_item_label, is_pinned, displacement, panel_width_pixels)
SELECT 1, selected_item_label, is_pinned, displacement, panel_width_pixels
FROM legacy.side_menu_state NOT INDEXED
WHERE id = 1;
