-- A single-row table. The row is not seeded: the reader falls back to
-- defaults when it is absent and the writer upserts.
CREATE TABLE side_menu_state (
    id                   INTEGER PRIMARY KEY CHECK (id = 1),
    selected_item_label  TEXT,
    is_pinned            INTEGER NOT NULL DEFAULT 0,
    displacement         INTEGER NOT NULL DEFAULT 0,
    panel_width_pixels   INTEGER NOT NULL DEFAULT 360
);
