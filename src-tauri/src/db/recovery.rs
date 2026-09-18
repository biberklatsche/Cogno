use super::error::{DbError, DbResult};
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// What happened when a database failed its integrity check on open.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryReport {
    /// The problems `quick_check` reported (or the open error).
    pub reasons: Vec<String>,
    /// Where the damaged file was moved to. It is never deleted.
    pub quarantined_path: String,
    /// Per-table result of copying rows out of the damaged file.
    pub tables: Vec<TableRecovery>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRecovery {
    pub name: String,
    pub rows_restored: u64,
    pub error: Option<String>,
}

/// Moves the database and its WAL/SHM siblings out of the way so a fresh
/// file can be created at `path`. The siblings keep their suffix relative to
/// the new name so SQLite still associates them when the copy is attached.
pub fn quarantine(path: &Path) -> DbResult<PathBuf> {
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "database".to_string());
    let quarantined =
        path.with_file_name(format!("{file_name}.corrupt-{}", super::now_ms() / 1000));

    std::fs::rename(path, &quarantined)?;
    for suffix in ["-wal", "-shm"] {
        let sibling = sibling_path(path, suffix);
        if sibling.exists() {
            std::fs::rename(sibling, sibling_path(&quarantined, suffix))?;
        }
    }

    log::warn!(
        "[db] quarantined damaged database {} -> {}",
        path.display(),
        quarantined.display()
    );
    Ok(quarantined)
}

/// Copies whatever rows are still readable from `source` into `conn`, table
/// by table. `conn` must already carry the current schema; only columns that
/// exist on both sides are copied, and constraint violations (typically the
/// duplicates left behind by a broken unique index) are skipped rather than
/// aborting the table. Every table runs in its own transaction: once SQLite
/// reports SQLITE_CORRUPT the surrounding transaction can no longer commit,
/// so a shared one would lose every table restored before the damaged one.
pub fn restore_rows(conn: &mut Connection, source: &Path) -> DbResult<Vec<TableRecovery>> {
    conn.execute(
        "ATTACH DATABASE ?1 AS damaged",
        [source.to_string_lossy().as_ref()],
    )?;

    let result = restore_attached(conn);

    // Detach even when the copy failed; a lingering attachment would keep the
    // damaged file locked.
    if let Err(e) = conn.execute_batch("DETACH DATABASE damaged") {
        log::warn!("[db] could not detach damaged database: {e}");
    }

    result
}

fn restore_attached(conn: &mut Connection) -> DbResult<Vec<TableRecovery>> {
    let tables = user_tables(conn, "main")?;
    let mut report = Vec::with_capacity(tables.len());

    for table in tables {
        let outcome = conn.transaction().map_err(DbError::from).and_then(|tx| {
            let rows = copy_table(&tx, &table)?;
            tx.commit()?;
            Ok(rows)
        });
        report.push(match outcome {
            Ok(rows_restored) => TableRecovery {
                name: table,
                rows_restored,
                error: None,
            },
            Err(e) => {
                log::warn!("[db] could not restore table {table}: {e}");
                TableRecovery {
                    name: table,
                    rows_restored: 0,
                    error: Some(e.to_string()),
                }
            }
        });
    }

    // Full-text indexes are not copied (their shadow tables only make sense
    // together); rebuild them from the content tables that were.
    for fts_table in fts5_tables(conn, "main")? {
        let sql = format!(
            "INSERT INTO {0}({0}) VALUES ('rebuild')",
            quote_identifier(&fts_table)
        );
        if let Err(e) = conn.execute_batch(&sql) {
            log::warn!("[db] could not rebuild full-text index {fts_table}: {e}");
        }
    }

    Ok(report)
}

fn copy_table(tx: &rusqlite::Transaction<'_>, table: &str) -> DbResult<u64> {
    let source_columns = columns(tx, "damaged", table)?;
    if source_columns.is_empty() {
        // Table does not exist in the damaged file; nothing to copy.
        return Ok(0);
    }
    let target_columns = columns(tx, "main", table)?;
    let shared: Vec<String> = target_columns
        .into_iter()
        .filter(|column| source_columns.contains(column))
        .collect();
    if shared.is_empty() {
        return Ok(0);
    }

    let column_list = shared
        .iter()
        .map(|column| quote_identifier(column))
        .collect::<Vec<_>>()
        .join(", ");
    let table_identifier = quote_identifier(table);

    // NOT INDEXED forces a table scan: the indexes are the part most likely
    // to be broken, and reading through them would reproduce the damage.
    let sql = format!(
        "INSERT OR IGNORE INTO main.{table_identifier} ({column_list}) \
         SELECT {column_list} FROM damaged.{table_identifier} NOT INDEXED"
    );

    Ok(tx.execute(&sql, [])? as u64)
}

/// Ordinary tables the application owns, in creation order so parents come
/// before children for foreign keys. Virtual tables and their shadow tables
/// are left out: they are derived from ordinary tables and rebuilt after.
fn user_tables(conn: &Connection, schema: &str) -> DbResult<Vec<String>> {
    let virtual_tables = virtual_tables(conn, schema)?;
    let mut statement = conn.prepare(&format!(
        "SELECT name FROM {schema}.sqlite_master \
         WHERE type = 'table' \
           AND name NOT LIKE 'sqlite_%' \
           AND name != 'schema_migrations' \
         ORDER BY rowid"
    ))?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names
        .into_iter()
        .filter(|name| !is_virtual_or_shadow(name, &virtual_tables))
        .collect())
}

fn virtual_tables(conn: &Connection, schema: &str) -> DbResult<Vec<String>> {
    let mut statement = conn.prepare(&format!(
        "SELECT name FROM {schema}.sqlite_master \
         WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%'"
    ))?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

fn fts5_tables(conn: &Connection, schema: &str) -> DbResult<Vec<String>> {
    let mut statement = conn.prepare(&format!(
        "SELECT name FROM {schema}.sqlite_master \
         WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%USING fts5%'"
    ))?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

/// Shadow tables are named `<virtual>_<suffix>` (e.g. `command_fts_data`).
fn is_virtual_or_shadow(name: &str, virtual_tables: &[String]) -> bool {
    virtual_tables
        .iter()
        .any(|vt| name == vt || name.starts_with(&format!("{vt}_")))
}

fn columns(conn: &Connection, schema: &str, table: &str) -> DbResult<Vec<String>> {
    let mut statement =
        conn.prepare(&format!("SELECT name FROM {schema}.pragma_table_info(?1)"))?;
    let names = statement
        .query_map([table], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn sibling_path(path: &Path, suffix: &str) -> PathBuf {
    let mut os_string = path.as_os_str().to_os_string();
    os_string.push(suffix);
    PathBuf::from(os_string)
}
