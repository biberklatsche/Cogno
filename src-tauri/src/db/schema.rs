use super::migrations::Migration;

/// File name of the application database inside the Cogno home directory.
/// The previous generation lived in `cogno.db`; it is read once by the
/// import step and otherwise left untouched.
pub const DB_FILE_NAME: &str = "cogno-v2.db";

/// Every schema step in order. Append only — a shipped entry must never be
/// edited, the runner refuses to start on a checksum mismatch.
pub const MIGRATIONS: &[Migration] = &[Migration {
    id: "app/001-init",
    sql: include_str!("migrations/001_init.sql"),
}];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use rusqlite::Connection;

    fn open_in_memory() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::connection::configure(&conn).unwrap();
        crate::db::migrations::apply(&mut conn, MIGRATIONS).unwrap();
        conn
    }

    #[test]
    fn schema_applies_on_a_fresh_file_via_db() {
        let dir = std::env::temp_dir().join(format!("cogno-schema-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = Db::new();

        let report = db.open(&dir.join("app.db"), MIGRATIONS).unwrap();

        assert_eq!(report.applied_migrations, vec!["app/001-init"]);
        db.close();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn every_expected_table_exists() {
        let conn = open_in_memory();
        let mut statement = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .unwrap();
        let tables: Vec<String> = statement
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        for expected in [
            "shell_context",
            "path",
            "dir_stat",
            "command",
            "command_fts",
            "command_log",
            "command_stat",
            "command_transition_stat",
            "command_pattern",
            "command_pattern_slot_value",
            "workspace",
            "workspace_tab",
            "workspace_grid",
            "terminal_session",
            "side_menu_state",
            "schema_migrations",
        ] {
            assert!(tables.iter().any(|t| t == expected), "missing table {expected}");
        }
    }

    #[test]
    fn side_menu_state_accepts_only_row_one() {
        let conn = open_in_memory();
        conn.execute("INSERT INTO side_menu_state (id) VALUES (1)", []).unwrap();
        let width: i64 = conn
            .query_row("SELECT panel_width_pixels FROM side_menu_state WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(width, 360);
        assert!(conn
            .execute("INSERT INTO side_menu_state (id) VALUES (2)", [])
            .is_err());
    }

    #[test]
    fn recovery_restores_real_schema_and_rebuilds_fts() {
        let dir = std::env::temp_dir().join(format!("cogno-schema-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let source = dir.join("old.db");
        {
            let mut conn = Connection::open(&source).unwrap();
            crate::db::connection::configure(&conn).unwrap();
            crate::db::migrations::apply(&mut conn, MIGRATIONS).unwrap();
            conn.execute_batch(
                "INSERT INTO shell_context (id, backend_os, shell_type, created_at) VALUES (1, 'windows', 'PowerShell', 1);
                 INSERT INTO path (id, path, basename, depth, created_at) VALUES (1, 'C:\\', 'C:', 0, 1);
                 INSERT INTO command (id, command_text, created_at) VALUES (1, 'pnpm run lint:fix', 1), (2, 'git status', 1);
                 INSERT INTO command_log (context_id, cwd_path_id, command_id, executed_at) VALUES (1, 1, 1, 1), (1, 1, 2, 2);
                 INSERT INTO side_menu_state (id, panel_width_pixels) VALUES (1, 512);",
            )
            .unwrap();
        }

        let db = Db::new();
        db.open(&dir.join("new.db"), MIGRATIONS).unwrap();
        let tables = db
            .with_connection(|conn| crate::db::recovery::restore_rows(conn, &source))
            .unwrap();

        assert!(tables.iter().all(|t| t.error.is_none()), "{tables:#?}");
        assert!(
            !tables.iter().any(|t| t.name.starts_with("command_fts")),
            "virtual and shadow tables must not be copied: {tables:#?}"
        );
        db.with_connection(|conn| {
            let logs: i64 = conn.query_row("SELECT COUNT(*) FROM command_log", [], |r| r.get(0))?;
            assert_eq!(logs, 2);
            let hits: i64 = conn.query_row(
                "SELECT COUNT(*) FROM command_fts WHERE command_fts MATCH 'lint'",
                [],
                |r| r.get(0),
            )?;
            assert_eq!(hits, 1, "full-text index must be rebuilt, without duplicates");
            let width: i64 =
                conn.query_row("SELECT panel_width_pixels FROM side_menu_state", [], |r| r.get(0))?;
            assert_eq!(width, 512, "recovered ui state must not be shadowed by a seed");
            Ok(())
        })
        .unwrap();

        db.close();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn command_fts_follows_command_table() {
        let conn = open_in_memory();
        conn.execute(
            "INSERT INTO command (command_text, created_at) VALUES ('pnpm run lint:fix', 1)",
            [],
        )
        .unwrap();

        let matches = |fragment: &str| -> i64 {
            conn.query_row(
                "SELECT COUNT(*) FROM command_fts WHERE command_fts MATCH ?1",
                [fragment],
                |r| r.get(0),
            )
            .unwrap()
        };
        assert_eq!(matches("lint"), 1, "substring in the middle must hit");
        assert_eq!(matches("fix"), 1);

        conn.execute("DELETE FROM command", []).unwrap();
        assert_eq!(matches("lint"), 0, "delete trigger must remove the index entry");
    }

    #[test]
    fn foreign_keys_cascade_and_are_enforced() {
        let conn = open_in_memory();
        conn.execute_batch(
            "INSERT INTO workspace (id, name, position, created_at, updated_at) VALUES ('w1', 'one', 0, 1, 1);
             INSERT INTO workspace_tab (workspace_id, tab_id, is_active, position) VALUES ('w1', 't1', 1, 0);
             INSERT INTO workspace_grid (workspace_id, tab_id, pane_json) VALUES ('w1', 't1', '{}');
             INSERT INTO terminal_session (workspace_id, terminal_id, session_data, updated_at) VALUES ('w1', 'term', 'x', 1);",
        )
        .unwrap();

        // Dangling references are rejected …
        assert!(conn
            .execute(
                "INSERT INTO workspace_tab (workspace_id, tab_id, position) VALUES ('nope', 't', 0)",
                []
            )
            .is_err());

        // … and deleting the parent takes everything below it along.
        conn.execute("DELETE FROM workspace WHERE id = 'w1'", []).unwrap();
        for table in ["workspace_tab", "workspace_grid", "terminal_session"] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0, "{table} should be empty after cascade");
        }
    }

    #[test]
    fn only_one_active_tab_per_workspace() {
        let conn = open_in_memory();
        conn.execute_batch(
            "INSERT INTO workspace (id, name, position, created_at, updated_at) VALUES ('w1', 'one', 0, 1, 1);
             INSERT INTO workspace_tab (workspace_id, tab_id, is_active, position) VALUES ('w1', 't1', 1, 0);",
        )
        .unwrap();

        let second_active = conn.execute(
            "INSERT INTO workspace_tab (workspace_id, tab_id, is_active, position) VALUES ('w1', 't2', 1, 1)",
            [],
        );
        assert!(second_active.is_err());
    }

    #[test]
    fn shell_context_is_unique_including_empty_distro() {
        let conn = open_in_memory();
        let insert = |os: &str, shell: &str, distro: &str| {
            conn.execute(
                "INSERT INTO shell_context (backend_os, shell_type, wsl_distro, created_at) VALUES (?1, ?2, ?3, 1)",
                [os, shell, distro],
            )
        };
        insert("windows", "PowerShell", "").unwrap();
        assert!(insert("windows", "PowerShell", "").is_err());
        insert("windows", "Bash", "Ubuntu").unwrap();
        insert("windows", "Bash", "Debian").unwrap();
    }

    #[test]
    fn schema_has_no_soft_delete_columns() {
        let conn = open_in_memory();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master m, pragma_table_info(m.name) p
                 WHERE m.type = 'table' AND p.name = 'deleted_at'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }
}
