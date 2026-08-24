use super::migrations::Migration;

/// File name of the application database inside the Cogno home directory.
/// The previous generation lived in `cogno.db`; it is read once by the
/// import step and otherwise left untouched.
pub const DB_FILE_NAME: &str = "cogno-v2.db";

/// Every schema step in order. Append only.
pub const MIGRATIONS: &[Migration] = &[];
