//! The application database.
//!
//! One process, one SQLite connection, guarded by a mutex. The webview sends
//! SQL — the schema and every query belong to the frontend packages that
//! own them — and this module guarantees how it runs: a batch is one
//! transaction on the one connection. A transaction that cannot be split
//! across calls cannot be left half-committed.

pub mod commands;
pub(crate) mod connection;
mod error;
pub(crate) mod migrations;
pub(crate) mod recovery;
mod values;

pub use error::{DbError, DbResult};
pub use migrations::{LegacyMigrationError, Migration};
pub use recovery::{RecoveryReport, TableRecovery};

use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenReport {
    pub path: String,
    /// Present when the file failed its integrity check and was rebuilt.
    pub recovery: Option<RecoveryReport>,
    /// Migration ids applied during this open.
    pub applied_migrations: Vec<String>,
    /// Legacy import steps that failed; they are recorded as applied and
    /// will not run again.
    pub legacy_errors: Vec<LegacyMigrationError>,
}

struct OpenDatabase {
    path: PathBuf,
    conn: Connection,
}

#[derive(Default)]
pub struct Db {
    inner: Mutex<Option<OpenDatabase>>,
}

impl Db {
    pub fn new() -> Self {
        Self::default()
    }

    /// Opens the database at `path`, verifying it and bringing the schema up
    /// to date. A file that fails `quick_check` is quarantined, a fresh file
    /// is created with the current schema, and every readable row is copied
    /// across. Calling `open` again with the same path is a no-op.
    pub fn open(
        &self,
        path: &Path,
        migrations: &[Migration],
        legacy: Option<&Path>,
    ) -> DbResult<OpenReport> {
        let mut guard = self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner());

        if let Some(open) = guard.as_ref() {
            if open.path == path {
                return Ok(OpenReport {
                    path: path.display().to_string(),
                    recovery: None,
                    applied_migrations: Vec::new(),
                    legacy_errors: Vec::new(),
                });
            }
            // A different path means a different home directory; close the
            // old one properly before switching.
            if let Some(previous) = guard.take() {
                let _ = connection::checkpoint(&previous.conn);
            }
        }

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let (mut conn, mut recovery) = match open_verified(path) {
            Ok(conn) => (conn, None),
            Err(reasons) => {
                let quarantined = recovery::quarantine(path)?;
                let conn = open_verified(path).map_err(|reasons| {
                    DbError::Migration(format!(
                        "could not create a fresh database after quarantine: {}",
                        reasons.join("; ")
                    ))
                })?;
                (
                    conn,
                    Some(RecoveryReport {
                        reasons,
                        quarantined_path: quarantined.display().to_string(),
                        tables: Vec::new(),
                    }),
                )
            }
        };

        // The schema must exist before rows can be restored into it.
        let outcome = migrations::apply(&mut conn, migrations, legacy)?;

        if let Some(report) = recovery.as_mut() {
            let source = PathBuf::from(&report.quarantined_path);
            match recovery::restore_rows(&mut conn, &source) {
                Ok(tables) => report.tables = tables,
                Err(e) => log::warn!("[db] restore from quarantined file failed: {e}"),
            }
            log::warn!(
                "[db] rebuilt database; restored {} rows across {} tables",
                report.tables.iter().map(|t| t.rows_restored).sum::<u64>(),
                report.tables.len()
            );
        }

        log::info!("[db] opened {}", path.display());
        *guard = Some(OpenDatabase {
            path: path.to_path_buf(),
            conn,
        });

        Ok(OpenReport {
            path: path.display().to_string(),
            recovery,
            applied_migrations: outcome.applied,
            legacy_errors: outcome.legacy_errors,
        })
    }

    /// Runs `f` with exclusive access to the connection.
    pub fn with_connection<T>(
        &self,
        f: impl FnOnce(&mut Connection) -> DbResult<T>,
    ) -> DbResult<T> {
        let mut guard = self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let open = guard.as_mut().ok_or(DbError::NotOpen)?;
        f(&mut open.conn)
    }

    /// Checkpoints the WAL and closes the connection. Called on shutdown.
    pub fn close(&self) {
        let mut guard = self.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(open) = guard.take() {
            if let Err(e) = connection::checkpoint(&open.conn) {
                log::warn!("[db] checkpoint on close failed: {e}");
            }
            log::info!("[db] closed {}", open.path.display());
        }
    }
}

/// Opens the file and runs the integrity check. On failure the connection
/// is dropped and the reasons are returned so the caller can quarantine.
fn open_verified(path: &Path) -> Result<Connection, Vec<String>> {
    let conn = connection::open(path).map_err(|e| vec![e.to_string()])?;
    match connection::quick_check(&conn) {
        Ok(problems) if problems.is_empty() => Ok(conn),
        Ok(problems) => Err(problems),
        Err(e) => Err(vec![e.to_string()]),
    }
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::{Seek, SeekFrom, Write};

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("cogno-db-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }

        fn path(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn migration(id: &str, sql: &str) -> Migration {
        Migration {
            id: id.into(),
            sql: sql.into(),
            uses_legacy: false,
        }
    }

    fn legacy_migration(id: &str, sql: &str) -> Migration {
        Migration {
            uses_legacy: true,
            ..migration(id, sql)
        }
    }

    fn init() -> Migration {
        migration(
            "test/init",
            "CREATE TABLE small (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
             CREATE TABLE big (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);",
        )
    }

    fn add_column() -> Migration {
        migration("test/add-column", "ALTER TABLE small ADD COLUMN extra TEXT;")
    }

    fn count(db: &Db, table: &str) -> i64 {
        db.with_connection(|conn| {
            Ok(conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
        })
        .unwrap()
    }

    #[test]
    fn open_applies_settings_and_migrations() {
        let dir = TempDir::new();
        let db = Db::new();

        let report = db
            .open(&dir.path("app.db"), &[init(), add_column()], None)
            .unwrap();

        assert!(report.recovery.is_none());
        assert_eq!(report.applied_migrations, vec!["test/init", "test/add-column"]);
        db.with_connection(|conn| {
            let journal: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
            let foreign_keys: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
            assert_eq!(journal, "wal");
            assert_eq!(foreign_keys, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn bundled_sqlite_provides_fts5_trigram() {
        let dir = TempDir::new();
        let db = Db::new();
        db.open(&dir.path("app.db"), &[], None).unwrap();

        db.with_connection(|conn| {
            conn.execute_batch(
                "CREATE VIRTUAL TABLE probe USING fts5(text, tokenize='trigram');
                 INSERT INTO probe (text) VALUES ('pnpm run lint:fix');",
            )?;
            let hits: i64 = conn.query_row(
                "SELECT COUNT(*) FROM probe WHERE probe MATCH ?1",
                ["lint"],
                |r| r.get(0),
            )?;
            assert_eq!(hits, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn reopen_applies_only_new_migrations() {
        let dir = TempDir::new();
        let path = dir.path("app.db");

        let first = Db::new();
        first.open(&path, &[init()], None).unwrap();
        first.close();

        let second = Db::new();
        let report = second.open(&path, &[init(), add_column()], None).unwrap();

        assert_eq!(report.applied_migrations, vec!["test/add-column"]);
    }

    #[test]
    fn open_is_idempotent_for_same_path() {
        let dir = TempDir::new();
        let path = dir.path("app.db");
        let db = Db::new();

        db.open(&path, &[init()], None).unwrap();
        let report = db.open(&path, &[init()], None).unwrap();

        assert!(report.applied_migrations.is_empty());
        assert!(report.recovery.is_none());
    }

    #[test]
    fn edited_migration_is_rejected() {
        let dir = TempDir::new();
        let path = dir.path("app.db");

        let first = Db::new();
        first.open(&path, &[init()], None).unwrap();
        first.close();

        let edited = migration("test/init", "CREATE TABLE small (id INTEGER PRIMARY KEY);");
        let error = Db::new().open(&path, &[edited], None).unwrap_err();

        assert!(matches!(error, DbError::Migration(_)), "{error}");
        assert!(error.to_string().contains("checksum mismatch"));
    }

    #[test]
    fn with_connection_requires_open_database() {
        let db = Db::new();
        let error = db.with_connection(|_| Ok(())).unwrap_err();
        assert!(matches!(error, DbError::NotOpen));
    }

    #[test]
    fn legacy_migration_imports_when_the_old_file_exists() {
        let dir = TempDir::new();
        let legacy = dir.path("old.db");
        {
            let conn = Connection::open(&legacy).unwrap();
            conn.execute_batch(
                "CREATE TABLE old_small (id INTEGER, label TEXT);
                 INSERT INTO old_small VALUES (1, 'alpha'), (2, 'beta');",
            )
            .unwrap();
        }

        let import = legacy_migration(
            "test/import",
            "INSERT INTO small (id, name) SELECT id, label FROM legacy.old_small NOT INDEXED;",
        );
        let db = Db::new();
        let report = db
            .open(&dir.path("app.db"), &[init(), import.clone()], Some(&legacy))
            .unwrap();

        assert_eq!(report.applied_migrations, vec!["test/init", "test/import"]);
        assert!(report.legacy_errors.is_empty());
        assert_eq!(count(&db, "small"), 2);

        // The legacy file must not stay attached.
        db.with_connection(|conn| {
            let attached: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_database_list WHERE name = 'legacy'",
                [],
                |r| r.get(0),
            )?;
            assert_eq!(attached, 0);
            Ok(())
        })
        .unwrap();

        // Reopening does not import twice.
        db.close();
        let report = Db::new()
            .open(&dir.path("app.db"), &[init(), import], Some(&legacy))
            .unwrap();
        assert!(report.applied_migrations.is_empty());
    }

    #[test]
    fn legacy_migration_is_skipped_without_the_old_file() {
        let dir = TempDir::new();
        let import = legacy_migration(
            "test/import",
            "INSERT INTO small (id, name) SELECT id, label FROM legacy.old_small;",
        );

        let db = Db::new();
        let report = db
            .open(&dir.path("app.db"), &[init(), import], Some(&dir.path("missing.db")))
            .unwrap();

        assert_eq!(report.applied_migrations, vec!["test/init", "test/import"]);
        assert_eq!(count(&db, "small"), 0);
    }

    #[test]
    fn failing_legacy_migration_is_reported_and_does_not_block_startup() {
        let dir = TempDir::new();
        let legacy = dir.path("old.db");
        Connection::open(&legacy).unwrap();

        let import = legacy_migration(
            "test/import",
            "INSERT INTO small (id, name) SELECT id, label FROM legacy.does_not_exist;",
        );
        let db = Db::new();
        let report = db
            .open(&dir.path("app.db"), &[init(), import.clone()], Some(&legacy))
            .unwrap();

        assert_eq!(report.legacy_errors.len(), 1);
        assert_eq!(report.legacy_errors[0].id, "test/import");
        assert_eq!(report.applied_migrations, vec!["test/init", "test/import"]);

        db.close();
        let report = Db::new()
            .open(&dir.path("app.db"), &[init(), import], Some(&legacy))
            .unwrap();
        assert!(report.applied_migrations.is_empty(), "a failed import is not retried");
    }

    #[test]
    fn garbage_file_is_quarantined_and_replaced() {
        let dir = TempDir::new();
        let path = dir.path("app.db");
        fs::write(&path, b"this is not a database").unwrap();

        let db = Db::new();
        let report = db.open(&path, &[init()], None).unwrap();

        let recovery = report.recovery.expect("recovery report");
        assert!(!recovery.reasons.is_empty());
        assert!(PathBuf::from(&recovery.quarantined_path).exists());
        assert_eq!(report.applied_migrations, vec!["test/init"]);
        assert_eq!(count(&db, "small"), 0);
    }

    #[test]
    fn damaged_file_keeps_readable_rows() {
        let dir = TempDir::new();
        let path = dir.path("app.db");

        // Build a database whose `big` table spans many pages, then destroy
        // every page after its root. `big` is filled last, so its leaves are
        // the highest-numbered pages; everything else — including `small` —
        // lives below the root and survives.
        let (page_size, big_root_page) = {
            let db = Db::new();
            db.open(&path, &[init()], None).unwrap();
            let layout = db
                .with_connection(|conn| {
                    conn.execute_batch("INSERT INTO small (name) VALUES ('alpha'), ('beta')")?;
                    let payload = "x".repeat(1000);
                    let tx = conn.transaction()?;
                    for _ in 0..200 {
                        tx.execute("INSERT INTO big (payload) VALUES (?1)", [&payload])?;
                    }
                    tx.commit()?;
                    let page_size: u64 =
                        conn.query_row("PRAGMA page_size", [], |r| r.get(0))?;
                    let root: u64 = conn.query_row(
                        "SELECT rootpage FROM sqlite_master WHERE name = 'big'",
                        [],
                        |r| r.get(0),
                    )?;
                    Ok((page_size, root))
                })
                .unwrap();
            db.close();
            layout
        };

        let mut file = fs::OpenOptions::new().write(true).open(&path).unwrap();
        let length = file.metadata().unwrap().len();
        let zero_from = page_size * big_root_page; // first byte of the page after the root
        file.seek(SeekFrom::Start(zero_from)).unwrap();
        file.write_all(&vec![0u8; (length - zero_from) as usize]).unwrap();
        drop(file);

        let db = Db::new();
        let report = db.open(&path, &[init()], None).unwrap();

        let recovery = report.recovery.expect("recovery report");
        let small = recovery.tables.iter().find(|t| t.name == "small").unwrap();
        assert_eq!(small.rows_restored, 2, "{recovery:#?}");
        assert!(small.error.is_none());
        assert_eq!(count(&db, "small"), 2);

        let big = recovery.tables.iter().find(|t| t.name == "big").unwrap();
        assert!(big.error.is_some(), "big should be reported as unreadable");
        assert_eq!(count(&db, "big"), 0, "a failed table leaves nothing half-copied");

        // The quarantined copy and its siblings are still on disk.
        assert!(PathBuf::from(&recovery.quarantined_path).exists());
        assert!(path.exists());
    }

    #[test]
    fn restore_skips_duplicate_rows_and_missing_columns() {
        let dir = TempDir::new();
        let source = dir.path("old.db");
        {
            // An older layout: no `extra` column, an obsolete `legacy`
            // column, and a duplicate that the new UNIQUE constraint rejects.
            let conn = Connection::open(&source).unwrap();
            conn.execute_batch(
                "CREATE TABLE small (id INTEGER PRIMARY KEY, name TEXT, legacy TEXT);
                 INSERT INTO small (id, name, legacy) VALUES (1, 'alpha', 'a'), (2, 'alpha', 'b'), (3, 'gamma', 'c');",
            )
            .unwrap();
        }

        let db = Db::new();
        db.open(&dir.path("new.db"), &[init(), add_column()], None)
            .unwrap();
        let tables = db
            .with_connection(|conn| recovery::restore_rows(conn, &source))
            .unwrap();

        let small = tables.iter().find(|t| t.name == "small").unwrap();
        assert_eq!(small.rows_restored, 2);
        assert!(small.error.is_none());
        assert_eq!(count(&db, "small"), 2);
    }

    #[test]
    fn restore_skips_virtual_tables_and_rebuilds_fts() {
        let dir = TempDir::new();
        let schema = migration(
            "test/fts",
            "CREATE TABLE doc (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
             CREATE VIRTUAL TABLE doc_fts USING fts5(text, content='doc', content_rowid='id', tokenize='trigram');
             CREATE TRIGGER doc_ai AFTER INSERT ON doc BEGIN
                 INSERT INTO doc_fts (rowid, text) VALUES (new.id, new.text);
             END;",
        );
        let source = dir.path("old.db");
        {
            let mut conn = Connection::open(&source).unwrap();
            connection::configure(&conn).unwrap();
            migrations::apply(&mut conn, &[schema.clone()], None).unwrap();
            conn.execute_batch("INSERT INTO doc (text) VALUES ('pnpm run lint:fix'), ('git status')")
                .unwrap();
        }

        let db = Db::new();
        db.open(&dir.path("new.db"), &[schema], None).unwrap();
        let tables = db
            .with_connection(|conn| recovery::restore_rows(conn, &source))
            .unwrap();

        assert!(tables.iter().all(|t| t.error.is_none()), "{tables:#?}");
        assert!(
            !tables.iter().any(|t| t.name.starts_with("doc_fts")),
            "virtual and shadow tables must not be copied: {tables:#?}"
        );
        db.with_connection(|conn| {
            let hits: i64 = conn.query_row(
                "SELECT COUNT(*) FROM doc_fts WHERE doc_fts MATCH 'lint'",
                [],
                |r| r.get(0),
            )?;
            assert_eq!(hits, 1, "full-text index must be rebuilt, without duplicates");
            Ok(())
        })
        .unwrap();
    }
}
