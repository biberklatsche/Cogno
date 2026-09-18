//! Conversion between the JSON the webview sends and SQLite values.

use base64::Engine;
use rusqlite::types::{Value, ValueRef};
use rusqlite::Row;
use serde_json::{Map, Number};

/// A bound parameter from the frontend. JSON has no integer/real split, so
/// a number without a fractional part binds as INTEGER, anything else as
/// REAL. Arrays and objects are stored as their JSON text.
pub fn to_sqlite(value: &serde_json::Value) -> Value {
    match value {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Integer(*b as i64),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Integer(i)
            } else {
                Value::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => Value::Text(s.clone()),
        other => Value::Text(other.to_string()),
    }
}

pub fn to_sqlite_params(values: &[serde_json::Value]) -> Vec<Value> {
    values.iter().map(to_sqlite).collect()
}

/// One result row as `{ column: value }`, in the shape the previous plugin
/// produced so query code does not need to change.
pub fn row_to_json(
    row: &Row<'_>,
    columns: &[String],
) -> rusqlite::Result<Map<String, serde_json::Value>> {
    let mut object = Map::with_capacity(columns.len());
    for (index, column) in columns.iter().enumerate() {
        object.insert(column.clone(), from_sqlite(row.get_ref(index)?));
    }
    Ok(object)
}

fn from_sqlite(value: ValueRef<'_>) -> serde_json::Value {
    match value {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(i) => serde_json::Value::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        ValueRef::Text(t) => serde_json::Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => {
            serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(b))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;

    #[test]
    fn numbers_keep_their_kind() {
        assert!(matches!(to_sqlite(&json!(42)), Value::Integer(42)));
        assert!(matches!(to_sqlite(&json!(-7)), Value::Integer(-7)));
        assert!(matches!(to_sqlite(&json!(1.5)), Value::Real(f) if f == 1.5));
        assert!(matches!(to_sqlite(&json!(true)), Value::Integer(1)));
        assert!(matches!(to_sqlite(&json!(null)), Value::Null));
    }

    #[test]
    fn rows_come_back_as_objects() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE t (i INTEGER, r REAL, s TEXT, n TEXT, b BLOB);
             INSERT INTO t VALUES (1, 2.5, 'x', NULL, X'0102');",
        )
        .unwrap();
        let mut statement = conn.prepare("SELECT i, r, s, n, b FROM t").unwrap();
        let columns: Vec<String> = statement
            .column_names()
            .iter()
            .map(|c| c.to_string())
            .collect();
        let row = statement
            .query_row([], |row| row_to_json(row, &columns))
            .unwrap();
        assert_eq!(row["i"], json!(1));
        assert_eq!(row["r"], json!(2.5));
        assert_eq!(row["s"], json!("x"));
        assert_eq!(row["n"], json!(null));
        assert_eq!(row["b"], json!("AQI="));
    }
}
