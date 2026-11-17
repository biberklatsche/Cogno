//! The host: everything Cogno runs on the machine where the shell runs -
//! PTYs, the processes under them, the shells installed there. It runs as a
//! daemon of its own and knows no window and no webview: its clients send
//! requests and take events (`protocol`), over a byte stream (`wire`).

mod attachment;
pub mod console;
pub mod daemon;
pub mod daemon_start;
pub mod env_vars;
mod environment_builder;
mod flow_control;
mod host;
pub mod identity;
mod kept_hooks;
mod kept_output;
mod line_editor;
pub mod login_environment;
pub mod once;
pub mod private_file;
#[cfg(windows)]
pub mod process_job;
mod processes;
pub mod protocol;
mod relay;
mod server;
mod sessions;
mod shared_session;
mod shell_integration;
mod shell_process;
mod shell_spawner;
mod shells;
pub mod sync;
pub mod wire;

pub use host::EventSink;
