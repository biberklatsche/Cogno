-- Only one panel is expanded at a time and a panel always opens at its normal
-- size, so nothing is kept about it. Rows that only said "expanded" go too.
ALTER TABLE side_menu_panel DROP COLUMN is_expanded;
DELETE FROM side_menu_panel WHERE is_pinned = 0 AND width_pixels IS NULL AND is_open = 0;
