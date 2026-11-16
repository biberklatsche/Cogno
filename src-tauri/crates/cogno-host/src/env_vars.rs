//! The names of the environment variables Cogno sets for a shell. The shell
//! integration scripts and the `cogno` command line read them by these names.

/// Set to `1`: the shell runs in Cogno.
pub const COGNO: &str = "COGNO";
pub const TERM: &str = "TERM";
pub const TERM_PROGRAM: &str = "TERM_PROGRAM";
pub const PATH: &str = "PATH";
pub const LANG: &str = "LANG";
/// Where zsh looks for its `.zshrc`.
pub const ZDOTDIR: &str = "ZDOTDIR";

/// Tells one start of a shell from every other.
pub const COGNO_SESSION_ID: &str = "COGNO_SESSION_ID";
/// The app's terminal the shell belongs to.
pub const COGNO_TERMINAL_ID: &str = "COGNO_TERMINAL_ID";
/// The endpoint file of the host that runs the shell: a `cogno` typed in it
/// reaches that host, whatever build it is.
pub const COGNO_HOST: &str = "COGNO_HOST";
/// The secret the shell integration signs what it reports with.
pub const COGNO_SESSION_TOKEN: &str = "COGNO_SESSION_TOKEN";
/// Set only with shell integration: where its scripts lie.
pub const COGNO_INTEGRATION_ROOT: &str = "COGNO_INTEGRATION_ROOT";
pub const COGNO_LOG_DIR: &str = "COGNO_LOG_DIR";
pub const COGNO_ALLOW_USER_RC: &str = "COGNO_ALLOW_USER_RC";
pub const COGNO_LOGIN_PATH: &str = "COGNO_LOGIN_PATH";
pub const COGNO_PATH_PREFIX: &str = "COGNO_PATH_PREFIX";
pub const COGNO_WORKING_DIR: &str = "COGNO_WORKING_DIR";
pub const COGNO_CLI_PATH: &str = "COGNO_CLI_PATH";
/// PowerShell: the named pipe its integration takes line editor actions on.
pub const COGNO_LINE_EDITOR_PIPE_NAME: &str = "COGNO_LINE_EDITOR_PIPE_NAME";
/// zsh: the FIFO its integration takes line editor actions on.
pub const COGNO_LINE_EDITOR_PIPE: &str = "COGNO_LINE_EDITOR_PIPE";
/// bash: the file its integration reads a line editor action from.
pub const COGNO_LINE_EDITOR_FILE: &str = "COGNO_LINE_EDITOR_FILE";
