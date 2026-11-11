//! The host: everything Cogno runs on the machine where the shell runs -
//! PTYs, the processes under them, the shells installed there. It knows no
//! window and no webview: whoever embeds it sends requests and takes events
//! (`protocol`).

mod environment_builder;
mod flow_control;
mod host;
pub mod identity;
mod line_editor;
pub mod login_environment;
#[cfg(windows)]
pub mod process_job;
mod processes;
pub mod protocol;
mod pty;
mod server;
mod shell_spawner;
mod shells;
pub mod wire;

pub use host::{EventSink, Host};
pub use server::serve;
