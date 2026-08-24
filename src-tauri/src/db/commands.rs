use super::schema::{DB_FILE_NAME, MIGRATIONS};
use super::{Db, OpenReport};
use crate::commands::environment::get_cogno_home_dir;
use std::path::PathBuf;
use tauri::State;

/// Opens (or, once open, simply reports on) the application database.
/// Safe to call from every window; the first call does the work.
#[tauri::command]
pub fn db_open(db: State<'_, Db>, dev_mode: bool) -> Result<OpenReport, String> {
    let home = get_cogno_home_dir(dev_mode)?;
    let path = PathBuf::from(home).join(DB_FILE_NAME);
    db.open(&path, MIGRATIONS).map_err(|e| e.to_string())
}
