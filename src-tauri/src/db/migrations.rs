use super::error::{DbError, DbResult};
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

/// A single, append-only schema step. `id` must never be reused and `sql`
/// must never change once a build that contains it has shipped: the runner
/// stores a checksum and refuses to start when it no longer matches.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub id: &'static str,
    pub sql: &'static str,
}

/// Applies every migration that is not yet recorded in `schema_migrations`,
/// each in its own transaction. Returns the ids that were applied this run.
pub fn apply(conn: &mut Connection, migrations: &[Migration]) -> DbResult<Vec<String>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             id TEXT PRIMARY KEY,
             checksum TEXT NOT NULL,
             applied_at INTEGER NOT NULL
         )",
    )?;

    let applied = load_applied(conn)?;
    let mut seen = HashSet::new();
    let mut applied_now = Vec::new();

    for migration in migrations {
        if !seen.insert(migration.id) {
            return Err(DbError::Migration(format!(
                "duplicate migration id in code: {}",
                migration.id
            )));
        }

        let checksum = sha256_hex(migration.sql);
        if let Some(previous) = applied.get(migration.id) {
            if *previous != checksum {
                return Err(DbError::Migration(format!(
                    "checksum mismatch for {}: database has {previous}, code has {checksum}. \
                     Shipped migrations must not be edited; add a new one instead.",
                    migration.id
                )));
            }
            continue;
        }

        let tx = conn.transaction()?;
        tx.execute_batch(migration.sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?1, ?2, ?3)",
            params![migration.id, checksum, super::now_ms()],
        )?;
        tx.commit()?;

        log::info!("[db] applied migration {}", migration.id);
        applied_now.push(migration.id.to_string());
    }

    Ok(applied_now)
}

fn load_applied(conn: &Connection) -> DbResult<HashMap<String, String>> {
    let mut statement = conn.prepare("SELECT id, checksum FROM schema_migrations")?;
    let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn sha256_hex(content: &str) -> String {
    hex::encode(ring::digest::digest(&ring::digest::SHA256, content.as_bytes()).as_ref())
}
