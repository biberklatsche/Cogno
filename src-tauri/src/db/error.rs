use std::fmt;

#[derive(Debug)]
pub enum DbError {
    NotOpen,
    Sqlite(rusqlite::Error),
    Io(std::io::Error),
    Migration(String),
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::NotOpen => write!(f, "database is not open"),
            DbError::Sqlite(e) => write!(f, "sqlite error: {e}"),
            DbError::Io(e) => write!(f, "io error: {e}"),
            DbError::Migration(msg) => write!(f, "migration error: {msg}"),
        }
    }
}

impl std::error::Error for DbError {}

impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self {
        DbError::Sqlite(e)
    }
}

impl From<std::io::Error> for DbError {
    fn from(e: std::io::Error) -> Self {
        DbError::Io(e)
    }
}

pub type DbResult<T> = Result<T, DbError>;
