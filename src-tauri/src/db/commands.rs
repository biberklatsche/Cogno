use super::values::{row_to_json, to_sqlite_params};
use super::{Db, DbResult, Migration, OpenReport};
use crate::commands::environment::get_cogno_home_dir;
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Map;
use std::path::PathBuf;
use tauri::State;

/// File name of the application database inside the Cogno home directory.
const DB_FILE_NAME: &str = "cogno-v2.db";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

fn run<T>(db: &Db, f: impl FnOnce(&mut Connection) -> DbResult<T>) -> Result<T, String> {
    db.with_connection(f).map_err(|e| {
        log::error!("[db] {e}");
        e.to_string()
    })
}

/// Opens (or, once open, simply reports on) the application database and
/// brings its schema up to date with the migrations the frontend collected.
/// `legacy_path` points at the previous-generation database for migrations
/// that import from it. Safe to call from every window.
#[tauri::command]
pub fn db_open(
    db: State<'_, Db>,
    dev_mode: bool,
    migrations: Vec<Migration>,
    legacy_path: Option<String>,
) -> Result<OpenReport, String> {
    let home = get_cogno_home_dir(dev_mode)?;
    let path = PathBuf::from(home).join(DB_FILE_NAME);
    let legacy = legacy_path.map(PathBuf::from);
    db.open(&path, &migrations, legacy.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_execute(db: State<'_, Db>, statement: Statement) -> Result<ExecuteResult, String> {
    run(&db, |conn| execute(conn, &statement))
}

#[tauri::command]
pub fn db_select(
    db: State<'_, Db>,
    statement: Statement,
) -> Result<Vec<Map<String, serde_json::Value>>, String> {
    run(&db, |conn| select(conn, &statement))
}

/// Runs every statement in one transaction: either all of them take effect
/// or none does.
#[tauri::command]
pub fn db_batch(
    db: State<'_, Db>,
    statements: Vec<Statement>,
) -> Result<Vec<ExecuteResult>, String> {
    run(&db, |conn| batch(conn, &statements))
}

pub fn execute(conn: &Connection, statement: &Statement) -> DbResult<ExecuteResult> {
    let rows_affected = conn.execute(
        &statement.sql,
        params_from_iter(to_sqlite_params(&statement.params)),
    )?;
    Ok(ExecuteResult {
        rows_affected: rows_affected as u64,
        last_insert_id: conn.last_insert_rowid(),
    })
}

pub fn select(
    conn: &Connection,
    statement: &Statement,
) -> DbResult<Vec<Map<String, serde_json::Value>>> {
    let mut prepared = conn.prepare(&statement.sql)?;
    let columns: Vec<String> = prepared
        .column_names()
        .iter()
        .map(|column| column.to_string())
        .collect();
    let rows = prepared.query_map(
        params_from_iter(to_sqlite_params(&statement.params)),
        |row| row_to_json(row, &columns),
    )?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn batch(conn: &mut Connection, statements: &[Statement]) -> DbResult<Vec<ExecuteResult>> {
    let tx = conn.transaction()?;
    let mut results = Vec::with_capacity(statements.len());
    for statement in statements {
        results.push(execute(&tx, statement)?);
    }
    tx.commit()?;
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn statement(sql: &str, params: Vec<serde_json::Value>) -> Statement {
        Statement {
            sql: sql.into(),
            params,
        }
    }

    fn open() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, n REAL)",
        )
        .unwrap();
        conn
    }

    #[test]
    fn execute_reports_affected_rows_and_insert_id() {
        let conn = open();
        let result = execute(
            &conn,
            &statement(
                "INSERT INTO t (name, n) VALUES (?1, ?2)",
                vec![json!("a"), json!(1.5)],
            ),
        )
        .unwrap();
        assert_eq!(result.rows_affected, 1);
        assert_eq!(result.last_insert_id, 1);

        let rows = select(&conn, &statement("SELECT id, name, n FROM t", vec![])).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["name"], json!("a"));
        assert_eq!(rows[0]["n"], json!(1.5));
    }

    #[test]
    fn batch_is_all_or_nothing() {
        let mut conn = open();
        let failed = batch(
            &mut conn,
            &[
                statement("INSERT INTO t (name) VALUES ('a')", vec![]),
                statement("INSERT INTO t (name) VALUES ('a')", vec![]), // UNIQUE violation
            ],
        );
        assert!(failed.is_err());

        let rows = select(&conn, &statement("SELECT COUNT(*) AS c FROM t", vec![])).unwrap();
        assert_eq!(
            rows[0]["c"],
            json!(0),
            "the first insert must have rolled back"
        );

        let results = batch(
            &mut conn,
            &[
                statement("INSERT INTO t (name) VALUES (?1)", vec![json!("a")]),
                statement("INSERT INTO t (name) VALUES (?1)", vec![json!("b")]),
                statement("UPDATE t SET n = 1", vec![]),
            ],
        )
        .unwrap();
        assert_eq!(results.len(), 3);
        assert_eq!(results[1].last_insert_id, 2);
        assert_eq!(results[2].rows_affected, 2);
    }

    #[test]
    fn select_with_no_rows_returns_empty_vec() {
        let conn = open();
        let rows = select(
            &conn,
            &statement("SELECT * FROM t WHERE name = ?1", vec![json!("nope")]),
        )
        .unwrap();
        assert!(rows.is_empty());
    }
}
