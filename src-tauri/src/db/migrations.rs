use super::error::{DbError, DbResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// A single, append-only schema step, contributed by the frontend. `id` must
/// never be reused and `sql` must never change once a build that contains
/// it has shipped: the runner stores a checksum and refuses to start when it
/// no longer matches.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Migration {
    pub id: String,
    pub sql: String,
    /// The step reads from the previous-generation database, which is
    /// attached as `legacy` while it runs. It is skipped — but still
    /// recorded — when no such file exists.
    #[serde(default)]
    pub uses_legacy: bool,
}

/// A legacy step that could not be completed. The step is recorded as
/// applied so the application still starts; the caller decides how to
/// surface the loss.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyMigrationError {
    pub id: String,
    pub error: String,
}

#[derive(Debug, Default)]
pub struct MigrationOutcome {
    pub applied: Vec<String>,
    pub legacy_errors: Vec<LegacyMigrationError>,
}

/// Applies every migration that is not yet recorded in `schema_migrations`,
/// each in its own transaction.
pub fn apply(
    conn: &mut Connection,
    migrations: &[Migration],
    legacy: Option<&Path>,
) -> DbResult<MigrationOutcome> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             id TEXT PRIMARY KEY,
             checksum TEXT NOT NULL,
             applied_at INTEGER NOT NULL
         )",
    )?;

    let applied = load_applied(conn)?;
    let mut seen = HashSet::new();
    let mut outcome = MigrationOutcome::default();

    for migration in migrations {
        if !seen.insert(migration.id.as_str()) {
            return Err(DbError::Migration(format!(
                "duplicate migration id in code: {}",
                migration.id
            )));
        }

        let checksum = sha256_hex(&migration.sql);
        if let Some(previous) = applied.get(&migration.id) {
            if *previous != checksum {
                return Err(DbError::Migration(format!(
                    "checksum mismatch for {}: database has {previous}, code has {checksum}. \
                     Shipped migrations must not be edited; add a new one instead.",
                    migration.id
                )));
            }
            continue;
        }

        if migration.uses_legacy {
            match legacy.filter(|path| path.exists()) {
                Some(path) => {
                    if let Err(e) = run_with_legacy(conn, migration, path) {
                        log::warn!("[db] legacy migration {} failed: {e}", migration.id);
                        outcome.legacy_errors.push(LegacyMigrationError {
                            id: migration.id.clone(),
                            error: e.to_string(),
                        });
                    }
                }
                None => log::info!(
                    "[db] no legacy database; skipping migration {}",
                    migration.id
                ),
            }
            record(conn, &migration.id, &checksum)?;
        } else {
            let tx = conn.transaction()?;
            tx.execute_batch(&migration.sql)?;
            record(&tx, &migration.id, &checksum)?;
            tx.commit()?;
        }

        log::info!("[db] applied migration {}", migration.id);
        outcome.applied.push(migration.id.clone());
    }

    Ok(outcome)
}

/// ATTACH cannot run inside a transaction, so the attach/detach pair wraps
/// the transaction rather than living in it.
fn run_with_legacy(conn: &mut Connection, migration: &Migration, legacy: &Path) -> DbResult<()> {
    conn.execute(
        "ATTACH DATABASE ?1 AS legacy",
        [legacy.to_string_lossy().as_ref()],
    )?;
    let result = (|| -> DbResult<()> {
        let tx = conn.transaction()?;
        tx.execute_batch(&migration.sql)?;
        tx.commit()?;
        Ok(())
    })();
    if let Err(e) = conn.execute_batch("DETACH DATABASE legacy") {
        log::warn!("[db] could not detach legacy database: {e}");
    }
    result
}

fn record(conn: &Connection, id: &str, checksum: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?1, ?2, ?3)",
        params![id, checksum, super::now_ms()],
    )?;
    Ok(())
}

fn load_applied(conn: &Connection) -> DbResult<HashMap<String, String>> {
    let mut statement = conn.prepare("SELECT id, checksum FROM schema_migrations")?;
    let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn sha256_hex(content: &str) -> String {
    hex::encode(ring::digest::digest(&ring::digest::SHA256, content.as_bytes()).as_ref())
}
