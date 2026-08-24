use super::error::DbResult;
use rusqlite::Connection;
use std::path::Path;
use std::time::Duration;

const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);

/// Opens `path` and applies the connection settings the whole application
/// relies on. Because the app holds exactly one connection, these settings
/// are guaranteed to be in effect for every statement.
pub fn open(path: &Path) -> DbResult<Connection> {
    let conn = Connection::open(path)?;
    configure(&conn)?;
    Ok(conn)
}

pub fn configure(conn: &Connection) -> DbResult<()> {
    conn.busy_timeout(BUSY_TIMEOUT)?;
    // journal_mode is persisted in the file and answers with the resulting
    // mode, so it must be queried rather than executed.
    conn.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

/// Runs `PRAGMA quick_check` and returns every reported problem. An empty
/// vector means the file is healthy.
pub fn quick_check(conn: &Connection) -> DbResult<Vec<String>> {
    let mut statement = conn.prepare("PRAGMA quick_check")?;
    let problems = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(problems.into_iter().filter(|line| line != "ok").collect())
}

/// Folds the WAL back into the main file so the database is a single file
/// on disk. Called on shutdown; harmless when the WAL is already empty.
pub fn checkpoint(conn: &Connection) -> DbResult<()> {
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
    Ok(())
}
