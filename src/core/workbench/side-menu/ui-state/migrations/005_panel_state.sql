-- Everything the side menu keeps belongs to a panel: one row per panel that
-- differs from the default (floating, own width, not expanded). Pinned means
-- docked beside the terminals, so the global overlay/push choice goes away.
-- `is_open` marks the one docked panel that comes back after a restart; a
-- floating panel is a quick look and does not.
CREATE TABLE side_menu_panel (
    label         TEXT PRIMARY KEY,
    is_pinned     INTEGER NOT NULL DEFAULT 0,
    is_expanded   INTEGER NOT NULL DEFAULT 0,
    width_pixels  INTEGER,
    is_open       INTEGER NOT NULL DEFAULT 0
);
INSERT INTO side_menu_panel (label, is_expanded)
SELECT label, 1 FROM side_menu_expanded_panel;
-- The shared width carries over to the open panel, the only one known to have
-- been shaped with it.
INSERT INTO side_menu_panel (label, is_pinned, width_pixels, is_open)
SELECT selected_item_label, is_pinned <> 0, NULLIF(panel_width_pixels, 360), is_pinned <> 0
FROM side_menu_state
WHERE id = 1 AND selected_item_label IS NOT NULL
ON CONFLICT (label) DO UPDATE SET
    is_pinned = excluded.is_pinned,
    width_pixels = excluded.width_pixels,
    is_open = excluded.is_open;
DROP TABLE side_menu_expanded_panel;
DROP TABLE side_menu_state;
