/// The log file in the app's log dir, without extension: `cogno.log`. Named
/// here so the file the log plugin writes is the one the About dialog opens,
/// on a case-sensitive file system too; the plugin's own default is the
/// product name ("Cogno", "Cogno Dev").
pub const LOG_FILE_STEM: &str = "cogno";
